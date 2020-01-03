const fs = require('fs')

const TOKEN_SYMBOLS = {
    WHITESPACE: Symbol('WHITESPACE'),
    KW_DEF: Symbol('KW_DEF'),
    KW_END: Symbol('KW_END'),
    CONST_INTEGER: Symbol('CONST_INTEGER'),
    IDENTIFIER: Symbol('IDENTIFIER'),
    OPEN_PAREN: Symbol('OPEN_PAREN'),
    CLOSE_PAREN: Symbol('CLOSE_PAREN'),
    COMMA: Symbol('COMMA')
}

const TOKEN_REGEXES: [Symbol, RegExp][] = [
    [TOKEN_SYMBOLS.WHITESPACE, /^\s+/],
    [TOKEN_SYMBOLS.KW_DEF, /^def/],
    [TOKEN_SYMBOLS.KW_END, /^end/],
    [TOKEN_SYMBOLS.CONST_INTEGER, /^[0-9]+/],
    [TOKEN_SYMBOLS.IDENTIFIER, /^[a-zA-Z][a-zA-Z0-9]*/],
    [TOKEN_SYMBOLS.OPEN_PAREN, /^\(/],
    [TOKEN_SYMBOLS.CLOSE_PAREN, /^\)/],
    [TOKEN_SYMBOLS.COMMA, /^,/]
]

class Token {
    type: Symbol
    value: string
    constructor(type: Symbol, value: string) {
        this.type = type
        this.value = value
    }
}

class Tokenizer {
    code: string
    constructor(code: string) {
        this.code = code
    }
    tokenize(): Token[] {
        const tokens: Token[] = []
        while(this.code.length > 0) {
            let token = this.tokenize_one_token()
            tokens.push(token)
        }
        return tokens
    }

    tokenize_one_token() {
        let foundToken = false
        for (let [tokenSymbol, regex] of TOKEN_REGEXES) {
            if(regex.test(this.code)) {
                //console.log('trying ' + tokenName + ', ' + regex)
                const match = this.code.match(regex)
                const value = match[0]
                this.code = this.code.substring(value.length)
                return new Token(tokenSymbol, value)
            }
        } if(!foundToken) {
            throw new Error('tokenization error, remaining program: "' + this.code + '"')
        }
    }
}

class IntegerNode {
    constructor(readonly value: number) {}
}

class FunctionNode {
    constructor(readonly name: string, readonly arg_names: string[], readonly body: ASTNode) {}
}

class CallNode {
    constructor(readonly name: string, readonly arg_exprs: Expr[]) {}
}

class VarRefNode {
    constructor(readonly value: string) {}
}

type Expr = IntegerNode | CallNode | VarRefNode

type ASTNode = IntegerNode | FunctionNode | CallNode | VarRefNode

class Parser {
    tokens: Token[]
    constructor(tokens: Token[]) {
        this.tokens = tokens
    }
    parse(): ASTNode {
        return this.parse_def()
    }
    parse_def(): FunctionNode {
        this.consume(TOKEN_SYMBOLS.KW_DEF)
        const name = this.consume(TOKEN_SYMBOLS.IDENTIFIER).value
        const arg_names = this.parse_arg_names()
        const body = this.parse_expr()
        this.consume(TOKEN_SYMBOLS.KW_END)
        return new FunctionNode(name, arg_names, body)
    }
    parse_arg_names(): string[] {
        const arg_names: string[] = []
        this.consume(TOKEN_SYMBOLS.OPEN_PAREN)
        if(this.peek(TOKEN_SYMBOLS.IDENTIFIER)) {
            arg_names.push(this.consume(TOKEN_SYMBOLS.IDENTIFIER).value)
            while(this.peek(TOKEN_SYMBOLS.COMMA)) {
                this.consume(TOKEN_SYMBOLS.COMMA)
                arg_names.push(this.consume(TOKEN_SYMBOLS.IDENTIFIER).value)
            }
        }
        this.consume(TOKEN_SYMBOLS.CLOSE_PAREN)
        return arg_names
    }
    parse_expr(): Expr {
        if(this.peek(TOKEN_SYMBOLS.CONST_INTEGER)) {
            return this.parse_integer()
        } else if(this.peek(TOKEN_SYMBOLS.IDENTIFIER) && this.peek(TOKEN_SYMBOLS.OPEN_PAREN, 1)) {
            return this.parse_call()
        } else {
            return this.parse_var_ref()
        }
    }
    parse_integer(): IntegerNode {
        const token = this.consume(TOKEN_SYMBOLS.CONST_INTEGER)
        return new IntegerNode(parseInt(token.value))
    }
    parse_call(): CallNode {
        const name = this.consume(TOKEN_SYMBOLS.IDENTIFIER).value
        const arg_exprs = this.parse_arg_exprs()
        return new CallNode(name, arg_exprs)
    }
    parse_arg_exprs(): Expr[] {
        const arg_exprs: Expr[] = []
        this.consume(TOKEN_SYMBOLS.OPEN_PAREN)
        if(!this.peek(TOKEN_SYMBOLS.CLOSE_PAREN)) {
            arg_exprs.push(this.parse_expr())
            while(this.peek(TOKEN_SYMBOLS.COMMA)) {
                this.consume(TOKEN_SYMBOLS.COMMA)
                arg_exprs.push(this.parse_expr())
            }
        }
        this.consume(TOKEN_SYMBOLS.CLOSE_PAREN)
        return arg_exprs
    }
    parse_var_ref(): VarRefNode {
        const name = this.consume(TOKEN_SYMBOLS.IDENTIFIER).value
        return new VarRefNode(name)
    }
    peek(tokenSymbol: Symbol, offset: number = 0): boolean {
        let tokens = this.tokens.slice()
        let token: Token
        let offsetBy = 0
        while(offsetBy <= offset) {
            token = tokens.shift()
            // eat whitespace
            while(token.type == TOKEN_SYMBOLS.WHITESPACE) {
                token = tokens.shift()
            }
            offsetBy++
        }
        return token.type == tokenSymbol? true: false
    }
    consume(tokenSymbol: Symbol) {
        let token = this.tokens.shift()
        // eat whitespace
        while(token.type == TOKEN_SYMBOLS.WHITESPACE) {
            token = this.tokens.shift()
        }
        if(token.type == tokenSymbol) {
            return token
        } else {
            throw new Error('Expected token type ' + tokenSymbol.toString() + ' but got ' + token.type.toString())
        }
    }
}

class Generator {
    generate(node: ASTNode) {
        switch(node.constructor) {
            case FunctionNode:
                let functionNode = node as FunctionNode
                return `function ${functionNode.name}(${functionNode.arg_names.join(', ')}) { return ${this.generate(functionNode.body)} }`
            case CallNode:
                let callNode = node as CallNode
                return `${callNode.name}(${callNode.arg_exprs.map((arg_expr) => this.generate(arg_expr)).join(', ')})`
            case VarRefNode:
                return (node as VarRefNode).value
            case IntegerNode:
                return (node as IntegerNode).value
            default:
                throw new Error(`Unexpected node type: ${node.constructor.name}`)
        }
        
    }
}

const tokens = (new Tokenizer(fs.readFileSync('test.src', 'utf-8'))).tokenize()
//console.log(tokens)

const tree = (new Parser(tokens)).parse()
//console.log(JSON.stringify(tree))

const generated = (new Generator()).generate(tree)
const RUNTIME = "function add(x, y) { return x + y };"
const TEST = "console.log(f(1,2));"

console.log([RUNTIME, generated, TEST].join("\n"))
