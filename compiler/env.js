class Environment {
    /**
     * 
     * @param {Environment?} parent
     */
    constructor(parent) {
        this.parent = parent;
        this.vars = [];
    }

    findAddr() { // returns a nearest address
        if(this.vars.length == 0) {
            return 1;
        } else {
            let addr = 1;
            while(true) {
                if(this.vars.filter(v => v.addr == addr).length > 0) addr++;
                else break;
            }
            return addr;
        }
    }
    declareVar(name, type) { // declares a variables in a scope if it doesn't already exist
        if(this.vars.filter(v => v.name == name).length > 0) {
            throw `Variable ${name} cannot be declared as it already exist in a current scope`;
        }
        let addr = this.findAddr()
        this.vars.push({
            name,
            type,
            addr
        });
        return addr;
    }

    findVar(name) {
        const current = this.vars.filter(v => v.name == name);
        if(current.length > 0) {
            return [current[0], 0];
        } else {
            if(this.parent != undefined) {
                let vardata = this.parent.findVar(name);
                return [vardata[0], vardata[1] + 1];
            }
            else throw `Variable ${name} doesn't exist`;
        }
    }
}

module.exports = Environment;