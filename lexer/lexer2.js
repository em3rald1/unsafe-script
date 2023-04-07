const isNumber = (str) => {
    if(str.length == 2) return str == '0x' || str == '0b' || str.match(/[0-9]/gi).length == str.length;
    else if(str.startsWith('0x')) {
        const arr = str.slice(2);
        for(const el of arr) {
            if(!'0123456789abcdef'.includes(el.toLowerCase())) return false;
        }
        return true;
    } else if(str.startsWith('0b')) {
        const arr = str.slice(2);
        for(const el of arr) {
            if(!'01'.includes(el.toLowerCase())) return false;
        }
        return true;
    } else {
        return !isNaN(parseInt(str));
    }
}

const keywords = {
    int: "TypeKeyword",
    short: "TypeKeyword",
    char: "TypeKeyword",
    void: "TypeKeyword",
    while: "WhileKeyword", // done
    break: "BreakKeyword", // done
    typedef: "TypedefKeyword", // WIP
    struct: "StructKeyword", // done
    continue: "ContinueKeyword", // done
    goto: "GotoKeyword",
    if: "IfKeyword", // done
    else: "ElseKeyword", // done
    import: "ImportKeyword", 
    return: "ReturnKeyword", // done
};
const skippable = ' \n\r\t';

const nonstandard = `${skippable}+-/%*()[]{}&^|=!,.;<>"'`;

/**
 * 
 * @param {string} src 
 */

function tokenize(src) {
    let line = 1;
    let char = 1;
    const toks = [];
    for(let i = 0; i < src.length; i++) {
        const tok = src[i];
        console.log(i, tok);
        if('%*+-'.includes(tok)) {
            if(tok == '-' && src[i+1] == '>') {
                toks.push({ type: "StructRefToken", value: tok + src[++i], line, char});
                char++;
            }
            if(src[i+1] == '=') {
                toks.push({ type: "BinOpAssignToken", value: tok + src[++i], line, char});
                char++;
            } else {
                toks.push({ type : "BinOpToken", value: tok, line, char });
            }
        }
        else if(tok == '/') {
            if(src[i+1] == '/') {
                while(src[i] != '\n' && src[i] != undefined) i++;
                line++;
                char = 0;
            } else if(src[i+1] == '=') {
                toks.push({ type: "BinOpAssignToken", value: tok + src[++i], line, char});  
                char++;
            } else {
                toks.push({ type : "BinOpToken", value: tok, line, char });
            }
        }
        else if(tok == '(') toks.push({ type: "OpenParen", value: tok, line, char});
        else if(tok == ')') toks.push({ type: "CloseParen", value: tok, line, char});
        else if(tok == '[') toks.push({ type: "OpenBracket", value: tok, line, char});
        else if(skippable.includes(tok)) {
        }
        else if(tok == ']') toks.push({ type: "CloseBracket", value: tok, line, char});
        else if(tok == '{') toks.push({ type: "OpenBrace", value: tok, line, char});
        else if(tok == '}') toks.push({ type: "CloseBrace", value: tok, line, char});
        else if('&|'.includes(tok)) {
            if(src[i+1] == tok) {
                toks.push({ type: "LogicToken", value: tok + tok, line, char});
                i++;
                char++;
            } else if(src[i+1] == '=') {
                toks.push({ type: "BitwiseOpAssignToken", value: tok + src[++i], line, char});  
            } else {
                toks.push({ type: "BitwiseOpToken", value: tok, line, char});
            }
        } else if(tok == '^') {
            if(src[i+1] == '=') {
                toks.push({ type: "BitwiseOpAssignToken", value: tok + src[++i], line, char});
                char++;
            } else {
                toks.push({ type: "BitwiseOpToken", value: tok, line, char});
            }
        }
        else if(tok == '=') {
            if(src[i+1] == tok) {
                toks.push({ type: "ComparisonToken", value: tok + tok, line, char});
                i++; char++;
            } else {
                toks.push({ type: "EquToken", value: tok, line, char});
            }
        } else if(tok == ';') {
            toks.push({type:"Semicolon", value: tok, line, char});
        } else if(tok == '.') {
            toks.push({type: "Dot", value: tok, line, char});
        }
        else if(tok == ',') toks.push({type: "Comma", value: tok, char, line});
        else if(tok == '!') {
            if(src[i+1] == '=') {
                char++;
                toks.push({type: "ComparisonToken", value: tok + src[++i], char, line});
            } else {
                toks.push({type:"NotToken", value: tok, char, line});
            }
        }
        else if('<>'.includes(tok)) {
            if(src[i+1] == '=') {
                char++;
                toks.push({type: "ComparisonToken", value: tok + src[i+1], char, line});
                i++;
            } else if(src[i+1] == tok) {
                if(src[i+2] == '=') {
                    toks.push({type: "ShiftAssignToken", value: tok + tok + src[i+2], line, char});
                    i += 2;
                    char += 2;
                }
                else {
                    toks.push({type: "ShiftToken", value: tok + tok, line, char});
                    char++;
                    i++;
                }
            } else {
                toks.push({ type: "ComparisonToken", value: tok, char, line});
            }
        } else if(tok == '"') {
            let start = char;
            char++;
            let str = '';
            i++;
            while(src[i] != '"' && src[i] != undefined) {
                str += src[i++];
                char++;
            }
            toks.push({type:"StringToken",value:str, char: start, line});
        } else if(tok == "'") {
            char += 2;
            i++;
            const ch = src[i];
            if(ch == "'") {
                throw `Cannot use make an empty character. Line: ${line}, char: ${char}`;
            } else {
                toks.push({ type: "CharToken", value: ch, char: char-1, line});
                i++;
                if(src[i++] != "'") throw 'Expected \' after char token';
                char++; 
            }

        } else {
            if(isNumber(tok)) {
                let n = src[i];
                let start = char;
                while(i < src.length && isNumber(n) && !nonstandard.includes(src[i+1]) && src[i+1]) {
                    if(isNumber(n + src[i+1])) {
                        n += src[++i]; char++;
                    } else break;
                }
                toks.push({ type: "NumberToken", value: n, char: start, line});
            } else {
                let n = src[i];
                let start = char;
                while(i < src.length && !nonstandard.includes(src[i+1]) && !nonstandard.includes(src[i]) && src[i+1]) {
                    n += src[++i];
                    char++;
                }
                const reserved = keywords[n];
                typeof reserved == 'string' ? toks.push({type: reserved, value: n, line, char:start}) : toks.push({type:"IdentToken", value: n, line, char:start});
            }
        }

        if(tok == '\n') {
            char = 1;
            line += 1;
        }
        else {
            char++;
        }
    }
    toks.push({type: "EOF", value: "EOF", line, char});
    return toks;
}

module.exports = tokenize;