let str = 'hello';

str += funnyfun();
console.log(str);
function funnyfun() {
    str += ' x';
    return ' y';
}