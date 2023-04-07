const tokenize = require("../lexer/lexer2.js");
require("util").inspect.defaultOptions.depth = null;
class Parser {
    constructor(src) {
        this.source = src;
        this.tokens = tokenize(src);
        this.scopes = 0;
        this.functions = { "*_global": { args: [], vars: [] }};
        this.curfun = [ "*_global" ];
        this.whiles = 0;
        this.ifs = 0;
        
    }



    eof() {
        return this.at().type == 'EOF';
    }
    at() {
        return this.tokens[0];
    }
    next() {
        return this.tokens[1];
    }
    eat() {
        return this.tokens.shift();
    }

    throw(errMsg, line, char) {
        console.error(errMsg);
        console.error((line) + ": " + this.source.split("\n")[line-1]);
        let arrow = "";
        for(let i = 0; i < char + `${line}`.length; i++) arrow += '-';
        arrow += "^";
        console.error(arrow);
        process.exit(1);
    }

    expect(type) {
        const tok = this.eat();
        if(tok.type != type) {
            this.throw(`Expected token of type ${type}, received token of type ${tok.type} (${tok.value})`, tok.line, tok.char);
        }
        return tok;
    }

    parse_type() {
        const type = this.eat().value;
        let vtype = {
            type,
            isptr: false,
            timesptr: 0,
        };
        while(this.at().value == '*') {
            vtype.isptr = true;
            vtype.timesptr++;
            this.eat();
        }

        return vtype;
    }


    parse_var_fun_decl() {
        const type_ = this.at();
        const vtype = this.parse_type();
        const name = this.expect("IdentToken").value;
        if(this.at().type == 'EquToken') {
            this.eat();
            const value = this.parse_expr();
            this.expect("Semicolon");
            this.functions[this.curfun[0]].vars.push({ type: vtype, name });
            return {
                type: "VarDecl",
                vtype,
                name,
                value
            };
        } else if(this.at().type == 'Semicolon') {
            this.eat();
            this.functions[this.curfun[0]].vars.push({ type: vtype, name });
            return {
                type: "VarDecl",
                vtype,
                name,
                value: null
            };
        }
        this.expect("OpenParen");
        const args = [];
        while(!this.eof() && this.at().type != "CloseParen") {
            const t = this.parse_type();
            const pname = this.expect("IdentToken").value;
            args.push({ type: t, name: pname});
            if(this.at().type != "CloseParen") this.expect("Comma");
        }
        this.expect("CloseParen");

        if(Object.keys(this.functions).includes(name)) {
            this.throw(`Function ${name} already exists`, type_.line, type_.char);
        }
        this.functions[name] = {
            vars: [], args, vtype
        };
        this.curfun.unshift(name);

        const body = this.parse_stmt();

        this.curfun.shift();
        return {
            type: "FunDecl",
            rtype: vtype,
            name,
            args,
            body
        }
    }

    parse_while() {
        this.eat();
        this.expect("OpenParen");
        const cond = this.parse_expr();
        this.expect("CloseParen");
        const body = this.parse_stmt();
        return {
            type: "WhileStatement",
            cond, body
        };
    }



    parse_stmt() {
        if(this.at().type == 'TypeKeyword') {
            return this.parse_var_fun_decl();
        } else if(this.at().type == 'OpenBrace') {
            this.eat();
            const body = [];
            while(!this.eof() && this.at().type != 'CloseBrace') {
                body.push(this.parse_stmt());
            }
            this.expect("CloseBrace");
            return {
                type: "Scope",
                body
            };

        } else if(this.at().type == 'ReturnKeyword') {
            this.eat();
            const value = this.parse_expr();
            this.expect("Semicolon");
            return {
                type: "ReturnStatement",
                value
            };
        } else if(this.at().type == 'TypedefKeyword') {
            this.throw("Type definitions are not yet implemented", this.at().line, this.at().char);
        } else if(this.at().type == 'StructKeyword') {
            this.eat();
            const name = this.expect("IdentToken").value;
            this.expect("OpenBrace");
            const props = [];
            while(!this.eof() && this.at().type != "CloseBrace") {
                const ptype = this.parse_type();
                const pname = this.expect("IdentToken").value;
                this.expect("Semicolon");
                props.push({ type: ptype, name: pname });
            }
            this.expect("CloseBrace");
            this.expect("Semicolon");
            return {
                type: "StructStatement",
                name,
                props
            }
        } else if(this.at().type == 'WhileKeyword') {
            return this.parse_while();
        } else if(this.at().type == 'ContinueKeyword') {
            return {
                type: "ContinueStatement"
            };
        } else if(this.at().type == 'BreakKeyword') {
            return {
                type: "BreakStatement"
            };
        } else if(this.at().type == 'IfKeyword') {
            this.eat();
            this.expect("OpenParen");
            const cond = this.parse_expr();
            this.expect("CloseParen");
            this.functions[`*_if_${++this.ifs}`] = { args: [], vars: [] };
            this.curfun.unshift(`*_if_${this.ifs}`);
            const body = this.parse_stmt();
            this.curfun.shift();
            if(this.at().type == 'ElseKeyword') {
                this.eat();
                const elsebody = this.parse_stmt();
                return {
                    type: "IfStatement",
                    cond, body, elsebody
                };
            }
            return {
                type: "IfStatement",
                cond, body
            }
        } else if(this.at().type == 'Semicolon') {
            this.eat();
            return {
                type: "Semicolon"
            }
        }
        return this.parse_expr();
    }

    parse_expr() {
        return this.parse_shiftassignment();
    }

    parse_shiftassignment() {
        let left = this.parse_bitwiseassignment();
        while(this.at().type == 'ShiftAssignToken') {
            const op = this.eat().value;
            const right = this.parse_expr();
            left = {
                type: "ShiftAssignExpr",
                left, op, right,
                start: left.start,
                line: left.line
            };
        }
        return left;
    }

    parse_bitwiseassignment() {
        let left = this.parse_binopassignment();
        while(this.at().type == 'BitwiseOpAssignToken') {
            const op = this.eat().value;
            const right = this.parse_expr();
            left = {
                type: "BitwiseOpAssignExpr",
                left, op, right,
                start: left.start,
                line: left.line
            };

        }
        return left;
    }

    parse_binopassignment() {
        let left = this.parse_assignment();
        while(this.at().type == 'BinOpAssignToken') {
            const op = this.eat().value;
            const right = this.parse_expr();
            left = {
                type: "BinOpAssignExpr",
                left, op, right,
                start: left.start,
                line: left.line
            };
        }
        return left;
    }

    parse_assignment() {
        let left = this.parse_logical();
        while(this.at().type == 'EquToken') {
            this.eat();
            const right = this.parse_expr();
            left = {
                type: "AssignExpr",
                left, right,
                start: left.start,
                line: left.line
            };
        }
        return left;
    }

    parse_logical() {
        let left = this.parse_comparison();
        while(['&&', '||'].includes(this.at().value)) {
            const op = this.eat().value;
            const right = this.parse_comparison();
            left = {
                type: "LogicalExpr",
                left, op, right,
                start: left.start,
                line: left.line
            };
        }
        return left;
    }

    parse_comparison() {
        const left = this.parse_shift();
        if(this.at().type == 'ComparisonToken') {
            const op = this.eat().value;
            const right = this.parse_shift();
            return {
                type: "ComparisonExpr",
                left, op, right,
                start: left.start,
                line: left.line
            };
        }
        return left;
    }

    parse_shift() {
        let left = this.parse_bitwise();
        while(['>>', '<<'].includes(this.at().value)) {
            const op = this.eat().value;
            const right = this.parse_bitwise();
            left = {
                type: "ShiftExpr",
                left, op, right,
                start: left.start,
                line: left.line
            };
        }
        return left;
    }

    parse_bitwise() {
        let left = this.parse_add();
        while(['&', '|', '^'].includes(this.at().value)) {
            const op = this.eat().value;
            const right = this.parse_add();
            left = {
                type: "BitwiseExpr",
                left, op, right,
                start: left.start,
                line: left.line
            }
        }
        return left;
    }

    parse_add() {
        let left = this.parse_multi();
        while(['+', '-'].includes(this.at().value)) {
            const op = this.eat().value;
            const right = this.parse_multi();
            left = {
                type: "BinOpExpr",
                left, op, right,
                start: left.start,
                line: left.line
            };
        }
        return left;
    }

    parse_multi() {
        let left = this.parse_call_member();
        while(['*', '/', '%'].includes(this.at().value)) {
            const op = this.eat().value;
            const right = this.parse_call_member();
            left = {
                type: "BinOpExpr",
                left, op, right,
                start: left.start,
                line: left.line
            };
        }
        return left;
    }

    parse_call_member() {
        const member = this.parse_member();
        if(this.at().type == "OpenParen") {
            return this.parse_call(member);
        }
        return member;
    }

    parse_call(callee) {
        let expr = {
            type: "CallExpr",
            callee,
            args: []
        }
        this.eat();
        while(this.at().type != 'CloseParen') {
            expr.args.push(this.parse_expr());
            if(this.at().type != 'CloseParen') this.expect("Comma");
        }
        this.expect("CloseParen");

        if(this.at().type == 'OpenParen') {
            expr = this.parse_call(expr);
        }
        return expr;
    }

    parse_member() {
        let obj = this.parse_primary();
        while(this.at().type == "OpenBracket" || this.at().type == "Dot") {
            const op = this.eat();
            if(op.type == 'OpenBracket') {
                const property = this.parse_expr();
                this.expect("CloseBracket", "Close bracket expected after member expression");
                obj = { type: "MemberExpr", obj, property, computed: true, start: op.char, line: op.line };
            } else if(op.type == 'Dot') {
                const property = this.expect("IdentToken").value;
                obj = {
                    type: "MemberExpr", obj, property, computed: false, start: op.char, line: op.line
                };
            }
        }
        return obj;
    }

    parse_primary() {
        const tok = this.at();
        if(tok.type == 'NumberToken') {
            return {
                type: "NumberLiteral",
                value: parseInt(this.eat().value),
                start: tok.char,
                line: tok.line
            };
        } else if(tok.type == 'IdentToken') {
            return {
                type: "IdentLiteral",
                value: this.eat().value,
                start: tok.char,
                line: tok.line
            };
        } else if(tok.type == 'OpenParen') {
            this.eat();
            const val = this.parse_expr();
            this.expect("CloseParen");
            return val;
        } 
    }

    parse() {
        const prog = {
            type: "Program",
            body: []
        }

        while(!this.eof()) {
            prog.body.push(this.parse_stmt());
        }

        return prog;
    }

}
module.exports = Parser;