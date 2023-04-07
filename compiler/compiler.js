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
        this.regs[r].value = value;
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
            case 'BinOpExpr': {
                const op = this.opcompile(stmt.op);
                let left = this.compile(stmt.left, env)[0];
                let right = this.compile(stmt.right, env)[0];
                if(left.type == 'Number' && right.type == 'Number') {
                    return [{ type: "Number", value: this.tostr(left) + this.tostr(right)}, [`${this.tostr(left)}${op}${this.tostr(right)}`]];
                }
                let reg = this.ralloc([`${left[1]}${op}${right[1]}`, `${right[1]}${op}${left[1]}`]);
                if(reg[1] == 1) {
                    return [{type: "Register", value: reg[0], start: stmt.start, line: stmt.line}, [`${left[1]}${op}${right[1]}`, `${right[1]}${op}${left[1]}`]];
                }
                reg = reg[0];
                this.codes[this.curcode[0]] += `${op} R${reg} ${this.tostr(left)} ${this.tostr(right)}\n`;
                this.update(reg, `${left[1]}${op}${right[1]}`);

                return [{type: "Register", value: reg, start: stmt.start, line: stmt.line}, [`${left[1]}${op}${right[1]}`, `${right[1]}${op}${left[1]}`]];
            }
            case 'NumberLiteral': {
                return [{ type: "Number", value: stmt.value , start: stmt.start, line: stmt.line }, [`${stmt.value}`]];
            }
            case 'IdentLiteral': {
                const vardata = env.findVar(stmt.value);
                if(vardata[1] > 0) {
                    let reg = this.ralloc([])[0];
                    let curfp = 2;
                    for(let i = 0; i < vardata[1]; i++) {
                        this.codes[this.curcode[0]] += `LOD R${reg} R${curfp}\n`;
                        curfp = reg;
                    }
                    this.codes[this.curcode[0]] += `LLOD R${reg} R${reg} -${vardata[0].addr}\n`;
                    this.update(reg, stmt.value);
                    return [{ type: "Register", value: reg, start: stmt.start, line: stmt.line}, [ stmt.value ]];
                } else {
                    let reg = this.ralloc([])[0];
                    this.codes[this.curcode[0]] += `LLOD R${reg} R2 -${vardata[0].addr}\n`;
                    return [{ type: "Register", value: reg, start: stmt.start, line: stmt.line}, [ stmt.value ]];
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
        return `.US${name}_${func.type}${func.isptr ? '*'.repeat(func.timesptr) : ''}()`;
    }

    fuse_code() {
        const header = `BITS 32\nMINREG ${this.regs.length + 2}\nMINHEAP 0xffff\nMINSTACK 0xfff\nMOV R2 SP\nSUB SP SP ${this.parser.functions["*_global"].vars.length}\n`;
        const code = this.codes['global'] + `ADD SP SP ${this.parser.functions["*_global"].vars.length}\nMOV SP R2\nHLT\n` + Object.keys(this.codes).filter(v => v != 'global').map(k => `${this.compile_fname(k, this.parser.functions[k])}\n`+this.codes[k]);
        return header + code;
    }
}

const code = require("fs").readFileSync(process.argv[2], 'utf-8');
const compiler = new Compiler(code, 8);
console.log(compiler.program);
compiler.compile_code();
console.log(compiler.fuse_code());