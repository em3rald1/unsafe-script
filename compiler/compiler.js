const tokenize = require("../lexer/lexer2");
const Parser = require("../parser/parser");
const Environment = require("./env");


class Compiler {
    constructor(src, regs) {
        this.parser = new Parser(src);
        this.program = this.parser.parse();
        this.regs = [];
        this.fp = regs;
        for(let i = 0; i < regs - 2; i++) {
            this.regs.push({value: null, used: false});
        } 
        this.codes = { 'global': "" };
        this.curcode = ['global'];
    }

    ralloc(values = []) {
        const f1 = this.regs.findIndex(v => values.includes(v.value));
        if(f1 >= 0) {
            this.regs[f1].used = true;
            return [f1 + 3, 1];
        }
        else {
            const f2 = this.regs.findIndex(v => v.used == false);
            this.regs[f2].used = true;
            this.regs[f2].value = values[0];
            return [f2 + 3, 0];
        }
    }

    update(r, value) {
        this.regs[r-3].value = value;
    }

    freeAll() {
        for(let i = 0; i < this.regs.length; i++) {
            this.regs[i].used = false;
        }
    }

    /*
        Compile output: CompilerInternalValue(Register|Immediate|etc), [ 'a+b', 'b+a' ] (Value patterns)
    */

    /**
     * 
     * @param {{}} stmt 
     * @param {Environment} env 
     * @returns 
     */

    tostr(val) {
        if(val.type == 'Number') {
            return val.value;
        } else if(val.type == 'Register') {
            return `R${val.value}`;
        }
    }

    opcompile(op) {
        switch(op) {
            case '+': {
                return 'ADD';
            }
            case '-': {
                return 'SUB';
            }
            case '*': {
                return 'MLT';
            }
            case '/': {
                return 'DIV';
            }
            default: {
                return 'UNDEF';
            }
        }
    }

    pushAll() {
        for(let i = 0; i < this.regs.length; i++) {
            this.codes[this.curcode[0]] += `PSH R${i+3}\n`;
        }
    }

    popAll() {
        for(let i = this.regs.length; i > 0; i--) {
            this.codes[this.curcode[0]] += `POP R${i+2}\n`;
        }
    }

    /**
     * 
     * @param {{}} stmt 
     * @param {Environment} env 
     * @returns 
     */

    compile(stmt, env) {
        switch(stmt.type) {
            case 'VarDecl': {
                let addr = env.declareVar(stmt.name, stmt.type);
                
                const value = stmt.value;
                if(value != null) {
                    let data = `LSTR R2 -${addr} ${this.tostr(this.compile(value, env)[0])}\n`;
                    this.codes[this.curcode[0]] += data;
                }
                return [{ type: "Null"}, [null]];
            }
            case 'FunDecl': {
                this.curcode.unshift(stmt.name);
                const nenv = new Environment(env);
                let offset = this.parser.functions[stmt.name].vars.length + this.parser.functions[stmt.name].args.length;
                this.codes[this.curcode[0]] += `PSH R2\nMOV R2 SP\nADD SP SP ${offset}\n`; // header

                for(let i = 0; i < stmt.args.length; i++) {
                    const addr = env.declareVar(stmt.args[i].name, stmt.args[i].type);
                    this.codes[this.curcode[0]] += `LLOD R3 R2 ${i+1}\nLSTR R2 -${addr} R3\n`;
                }

                this.compile(stmt.body, nenv);
                this.codes[this.curcode[0]] += `${this.compile_fname(stmt.name, this.parser.functions[stmt.name])}_end\nSUB SP SP ${offset}\nMOV SP R2\nPOP R2\nRET\n`;
                this.curcode.shift();
                return [{ type: "Null"}, [null]];
            }
            case 'Scope': {
                for(let i = 0; i < stmt.body.length; i++) {
                    this.compile(stmt.body[i], env);
                    this.freeAll();
                }
                return [{ type: "Null"}, [null]];
            }
            case 'ReturnStatement': {
                let res = this.compile(stmt.value, env)[0];
                this.codes[this.curcode[0]] += `MOV R1 ${this.tostr(res)}\nJMP ${this.compile_fname(this.curcode[0], this.parser.functions[this.curcode[0]])}_end\n`;
                return [{ type: "Null" }, [null]];
            }
            case 'BinOpExpr': {
                const op = this.opcompile(stmt.op);
                let left = this.compile(stmt.left, env);
                let right = this.compile(stmt.right, env);
                if(left[0].type == 'Number' && right[0].type == 'Number') {
                    return [{ type: "Number", value: this.tostr(left[0]) + this.tostr(right[0])}, [`${this.tostr(left[0])+this.tostr(right[0])}`]];
                }
                let reg = this.ralloc([`${left[1][0]}${stmt.op}${right[1][0]}`, `${right[1][0]}${stmt.op}${left[1][0]}`]);
                if(reg[1] == 1) {
                    return [{type: "Register", value: reg[0], start: stmt.start, line: stmt.line}, [`${left[1][0]}${stmt.op}${right[1][0]}`, `${right[1][0]}${stmt.op}${left[1][0]}`]];
                }
                reg = reg[0];
                this.codes[this.curcode[0]] += `${op} R${reg} ${this.tostr(left[0])} ${this.tostr(right[0])}\n`;
                this.update(reg, `${left[1][0]}${stmt.op}${right[1][0]}`);

                return [{type: "Register", value: reg, start: stmt.start, line: stmt.line}, [`${left[1][0]}${stmt.op}${right[1][0]}`, `${right[1][0]}${stmt.op}${left[1][0]}`]];
            }
            case 'CallExpr': { // TODO: Optimize on saved function call
                if(stmt.callee.type == 'IdentLiteral') {
                    const fn = this.parser.functions[stmt.callee.value];
                    const callee = this.compile_fname(stmt.callee.value, fn);

                    const used = [...this.regs];

                    used.filter(v => v.used).forEach((v, i) => {
                        this.codes[this.curcode[0]] += `PSH R${i+3}\n`;
                    })

                    stmt.args.forEach(v => {
                        let x = this.compile(v, env);
                        this.codes[this.curcode[0]] += `PSH ${this.tostr(x[0])}\n`;
                    })

                    this.codes[this.curcode[0]] += `CAL ${callee}\n`;

                    this.codes[this.curcode[0]] += `ADD SP SP ${stmt.args.length}\n`;

                    used.reverse().filter(v => v.used).forEach((v, i) => {
                        this.codes[this.curcode[0]] += `PSH R${i+3}\n`;
                    })

                    const reg = this.ralloc([])[0];
                    this.codes[this.curcode[0]] += `MOV R${reg} R1\n`;
                    return [{type: "Register", value: reg, start: stmt.start, line: stmt.line}, [``]];
                } else { // TODO: Allow calling to addresses

                }
            }
            case 'NumberLiteral': {
                return [{ type: "Number", value: stmt.value , start: stmt.start, line: stmt.line }, [`${stmt.value}`]];
            }
            case 'IdentLiteral': {
                const vardata = env.findVar(stmt.value);
                if(vardata[1] > 0) {
                    let reg = this.ralloc([`${stmt.value}[${vardata[0].version}]`]);
                    if(reg[1] == 1) {
                        return [{type: "Register", value: reg[0], start: stmt.start, line: stmt.line}, [`${stmt.value}[${vardata[0].version}]`]];
                    }
                    let curfp = 2;
                    for(let i = 0; i < vardata[1]; i++) {
                        this.codes[this.curcode[0]] += `LOD R${reg[0]} R${curfp}\n`;
                        curfp = reg[0];
                    }

                    this.codes[this.curcode[0]] += `LLOD R${reg[0]} R${reg[0]} -${vardata[0].addr}\n`;
                    this.update(reg[0], `${stmt.value}[${vardata[0].version}]`);
                    return [{ type: "Register", value: reg[0], start: stmt.start, line: stmt.line}, [ `${stmt.value}[${vardata[0].version}]` ]];
                } else {
                    let reg = this.ralloc([`${stmt.value}[${vardata[0].version}]`]);
                    if(reg[1] == 1) {
                        return [{type: "Register", value: reg[0], start: stmt.start, line: stmt.line}, [`${stmt.value}[${vardata[0].version}]`]];
                    }
                    this.codes[this.curcode[0]] += `LLOD R${reg[0]} R2 -${vardata[0].addr}\n`;
                    this.update(reg[0], `${stmt.value}[${vardata[0].version}]`);
                    return [{ type: "Register", value: reg[0], start: stmt.start, line: stmt.line}, [ `${stmt.value}[${vardata[0].version}]` ]];
                }
            }
            case 'MemberExpr': {
                if(stmt.computed) {
                    let obj = this.compile(stmt.obj, env);
                    let prop = this.compile(stmt.property, env);
                    let reg = this.ralloc([`[${obj[1][0]}+${prop[1][0]}]`, `[${prop[1][0]}+${obj[1][0]}]`]);
                    if(reg[1] == 1) {
                        return [{type: "Register", value: reg[0], start: stmt.start, line: stmt.line}, [`[${prop[1][0]}+${obj[1][0]}]`]];
                    }
                    this.codes[this.curcode[0]] += `LLOD R${reg[0]} ${this.tostr(obj[0])} ${this.tostr(prop[0])}\n`;
                    this.update(reg[0], `[${prop[1][0]}+${obj[1][0]}]`);
                    return [{type:"Register", value: reg[0], start: stmt.start, line: stmt.line}, [`[${prop[1][0]}+${obj[1][0]}]`]];
                } else {
                    throw 'Non-computed member expressions (aka x.y) are not supported.';
                }
            }
        }
    }


    compile_code() {
        const env = new Environment(null);
        for(let i = 0 ; i < this.program.body.length; i++) {
            this.compile(this.program.body[i], env);
            this.freeAll();
        }
    }

    compile_fname(name, func) {
        return `.US${name}_${func.vtype.type}${func.vtype.isptr ? '*'.repeat(func.vtype.timesptr) : ''}(${func.args.map(v => v.type.type + '*'.repeat(v.type.timesptr)).join("_")})`;
    }

    fuse_code() {
        const header = `BITS 32\nMINREG ${this.regs.length + 2}\nMINHEAP 0xffff\nMINSTACK 0xfff\nMOV R2 SP\nSUB SP SP ${this.parser.functions["*_global"].vars.length}\n`;
        const code = this.codes['global'] + 
            `ADD SP SP ${this.parser.functions["*_global"].vars.length}\nMOV SP R2\nHLT\n` + 
            Object.keys(this.codes)
                .filter(v => v != 'global')
                .map(k => `${this.compile_fname(k, this.parser.functions[k])}\n`+this.codes[k]);
        return header + code.replace('undefined', '');
    }
}

const code = require("fs").readFileSync(process.argv[2], 'utf-8');
const compiler = new Compiler(code, 8);
console.log(compiler.program);
console.log(compiler.parser.functions);