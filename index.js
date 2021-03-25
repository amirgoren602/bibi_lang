const topEnv = Object.create(null);
const specialForms = Object.create(null);

topEnv['print'] = (...args) => console.log(...args);

[
'+',
'-',
'*',
'/',
'%',
'==',
'!=',
'<',
'<=',
'>',
'>=',
].forEach(operator => {
    topEnv[operator] = new Function('a', 'b', `return a ${ operator } b;`);
});

topEnv['true'] = true;
topEnv['false'] = false;
topEnv['null'] = null;
topEnv['undefined'] = undefined;

specialForms[''] = (args, env) => {
    let value = null;
    args.forEach(arg => { value = evaluate(arg, env); });
    return value;
}

specialForms['put'] = (args, env) => {
    if (args.length !== 2) {
        throw new SyntaxError('Incorrect call to put');
    }
    if (args[0].type !== 'word') {
        throw new SyntaxError('Incorrect first argument to put');
    }
    const val = evaluate(args[1], env);
    env[args[0].name] = val;
    return val;
}

specialForms['while'] = (args, env) => {
    if (args.length !== 2) {
        throw new SyntaxError('Incorrect call to while');
    }
    while (evaluate(args[0], env)) {
        evaluate(args[1], env);
    }
    return null;
}

specialForms['if'] = (args, env) => {
    if (args.length !== 2 && args.length !== 3) {
        throw new SyntaxError('Incorrect call to if');
    }
    const [condition, ifDo, elseDo] = args;
    const value = evaluate(condition, env);
    if (value) {
        evaluate(ifDo, env);
    } else if (elseDo) {
        evaluate(elseDo, env);
    }
    return null;
}

specialForms['func'] = (args, env) => {
    if (args.length < 2) {
        throw new SyntaxError();
    }

    const name = args.shift();
    const body = args.pop();

    if (name.type !== 'word') {
        throw new SyntaxError('Incorrect first argument to func');
    }

    env[name.name] = (...params) => {
        const newEnv = Object.create(env);
        for (let i = 0; i < args.length; i++) {
            newEnv[args[i].name] = i < params.length ? params[i] : undefined;
        }
        return evaluate(body, newEnv);
    }
}

const stringRegex = /^"([^"]*)"/;
const numberRegex = /^\d+/;
const wordRegex = /^[^\s{}(),]+/;
const bareBrace = /^(?={)/;

function removeWhitespace(statement) {
    return statement.replace(/^\s*/, '');
}

function parseExpression(expression) {
    expression = removeWhitespace(expression);
    let match, expr;
    if ((match = expression.match(stringRegex)) !== null) {
        expr = { type: "value", value: match[1] };
    } else if ((match = expression.match(numberRegex)) !== null) {
        expr = { type: "value", value: Number(match[0]) };
    } else if ((match = expression.match(wordRegex)) !== null) {
        expr = { type: "word", name: match[0] };
    } else if ((match = expression.match(bareBrace)) !== null) {
        expr = { type: "word", name: "" };
    } else {
        throw new SyntaxError();
    }
    return parseApply(expr, expression.slice(match[0].length));
}

function parseApply(expr, rest) {
    rest = removeWhitespace(rest);

    if (rest[0] !== '{' && rest[0] !== '(') {
        return { expression: expr, rest: rest };
    }

    const expression = { type: 'apply', operator: expr, args: [] };

    if (rest[0] === '{') {
        return parseBraces(expression, removeWhitespace(rest.slice(1)));
    }

    if (rest[0] === '(') {
        return parseParentheses(expression, removeWhitespace(rest.slice(1)));
    }
}

function parseBraces(expression, rest) {
    while (rest[0] !== '}') {
        const arg = parseExpression(rest);
        expression.args.push(arg.expression);
        rest = removeWhitespace(arg.rest);
    }
    return parseApply(expression, rest.slice(1));
}

function parseParentheses(expression, rest) {
    while (rest[0] !== ')') {
        const arg = parseExpression(rest);
        expression.args.push(arg.expression);
        rest = removeWhitespace(arg.rest);
        if (rest[0] === ',') {
            rest = removeWhitespace(rest.slice(1));
        } else if (rest[0] !== ')') {
            throw new SyntaxError();
        }
    }
    return parseApply(expression, rest.slice(1));
}

function evaluate(expression, env) {
    switch (expression.type) {
        case "value":
            return expression.value;
            break;
        case "word":
            if (expression.name in env) {
                return env[expression.name];
            } else {
                throw new ReferenceError();
            }
            break;
        case "apply":
            if (expression.operator.type === "word" && expression.operator.name in specialForms) {
                return specialForms[expression.operator.name](expression.args, env);
            }

            const op = evaluate(expression.operator, env);
            if (typeof op !== 'function') {
                throw new TypeError();
            }
            return op.apply(null, expression.args.map(arg => evaluate(arg, env)));
            break;
    }
}

function parse(program) {
    const { expression, rest } = parseExpression(program);
    if (removeWhitespace(rest).length > 0) {
        throw new SyntaxError();
    }
    return expression;
}

function run(code) {
    const env = Object.create(topEnv);
    const parsed = parse(`{ ${ code } }`);
    return evaluate(parsed, env);
}

run(`
print(1)
`);

run(`
put(sum, 0)
put(i, 1)
while(<=(i, 10), {
  put(sum, +(sum, i))
  put(i, +(i, 1))
})
print(sum)
`);

run(`
put(i, 1)
while(<=(i, 5), {
  put(str, "")
  put(j, 1)
  while(<=(j,i), {
    put(str, +(str, "*"))
    put(j, +(j, 1))
  })
  print(str)
  put(i, +(i, 1))
})
`);

run(`
if(<=(1,0), { print("1 <= 0") })
if(<=(0,1), { print("0 <= 1") })
if(<=(1,0), { print("condition is true") }, { print("condition is false") })
`);

run(`
func(haha, msg, { print(msg) })
haha("hello, world!")
`);
