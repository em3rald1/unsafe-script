/**
 * @param {string} str
 */

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
    while: "WhileKeyword",
    break: "BreakKeyword",
    typedef: "TypedefKeyword",
    struct: "StructKeyword",
    continue: "ContinueKeyword",
    goto: "GotoKeyword",
    if: "IfKeyword",
    else: "ElseKeyword",
    import: "ImportKeyword",
    return: "ReturnKeyword",
};
const skippable = ' \n\r';

const nonstandard = `${skippable}+-/%*()[]{}&^|=!,;<>"'`;

/**
 * 
 * @param {string} str 
 */

function tokenize(str) {
    const arr = str.split("");
    let lines = 1;
    let chars = 1;
    const toks = []
    while(arr.length > 0) {
        const tok = arr[0];
        if('+-/%*'.includes(tok)) toks.push( { type : "BinOpToken", value: arr.shift(), line: lines, char: chars } );
        else if(tok == '(') toks.push( { type: "OpenParen", value: arr.shift(),line:lines,char:chars});
        else if(tok == ')') toks.push({type: "CloseParen",value:arr.shift(),line:lines,char:chars});
        else if(tok == '[') toks.push({type:"OpenBracket",value:arr.shift(),line:lines,char:chars});
        else if(tok == ']') toks.push({type:"CloseBracket",value:arr.shift(),line:lines,char:chars});
        else if('&^|'.includes(tok)) toks.push({type:"BitwiseOpToken",value:arr.shift(),line:lines,char:chars});
        else if(skippable.includes(tok)) arr.shift();
        else if(tok == '=') toks.push({type:"EquToken",value:arr.shift(),line:lines,char:chars});
        else if(tok == ';') toks.push({type:"Semicolon",value:arr.shift(),line:lines,char:chars});
        else if(tok == '{') toks.push({type:"OpenBrace",value:arr.shift(),line:lines,char:chars});
        else if(tok == '}') toks.push({type:"CloseBrace",value:arr.shift(),line:lines,char:chars});
        else if(tok == ',') toks.push({type:"Comma",value:arr.shift(),line:lines,char:chars});
        else if(tok == '!') toks.push({type:"NotToken",value:arr.shift(),line:lines,char:chars});
        else if('<>'.includes(tok)) toks.push({type:"ComparisonToken",value:arr.shift(),line:lines,char:chars});
        else if(tok == '"') {
            chars++;
            let start = chars;
            arr.shift();
            let str = '';
            while(arr.length > 0 && arr[0] != '"' && arr[0] != undefined) {
                chars++;
                str += arr.shift();
            }
            arr.shift();
            toks.push({type:"StringToken",value:str,line:lines,char:start});
        }
        else if(tok == "'") {
            chars += 2;
            arr.shift();
            const char = arr.shift();
            if(char == "'") {
                toks.push({type:"CharToken",value:'',line:lines,char:chars-1});
                
            } else {
                toks.push({type:"CharToken",value:char,line:lines,char:chars-2});
                if(arr.shift() != "'") throw `Expected closed single quote after a char\nLine: ${lines}, Character: ${chars}`;
                chars++;
            }
        }
        else {
            if(isNumber(tok)) {
                let n = arr.shift();
                let start = chars;
                while(arr.length > 0 && isNumber(n) && !nonstandard.includes(arr[0]) && arr[0] != undefined) {
                    if(isNumber(n + arr[0])) {
                        n += arr.shift(); chars++; 
                    }
                    else break;
                }
                toks.push({type:"NumberToken", value:n, line:lines, char:start});
            } else {
                let n = arr.shift();
                
                let start = chars;
                while(arr.length > 0 && !nonstandard.includes(arr[0]) && arr[0] != undefined && arr[0]) {
                    n += arr.shift();
                    chars++;
                }
                const reserved = keywords[n];
                typeof reserved == 'string' ? toks.push({type: reserved, value: n, line:lines, char:start}) : toks.push({type:"IdentToken", value: n, line: lines, char:start});
            }
        }

        if(arr[0] == '\n') { lines++; chars = 1 }
        else chars++;
    }
    toks.push({type: "EOF", value: "EOF", line:lines, char:chars})
    return toks;
}

module.exports = tokenize;