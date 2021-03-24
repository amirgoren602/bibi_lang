const topEnv = Object.create(null);
const special = Object.create(null);

topEnv['print'] = (...args) => console.log(...args);
topEnv['<='] = (a, b) => a <= b;
topEnv['+'] = (a, b) => a + b;

special[''] = (args, env) => { args.forEach(arg => evaluate(arg, env)); }
special['put'] = (args, env) => {
    if (args.length !== 2) {
        throw new SyntaxError();
    }
    const val = evaluate(args[1], env);
    env[args[0].name] = val;
    return val;
}
special['while'] = (args, env) => {
    if (args.length !== 2) {
        throw new SyntaxError();
    }
    while (evaluate(args[0], env)) {
        evaluate(args[1], env);
    }
}
special['if'] = (args, env) => {
    if (args.length !== 2 && args.length !== 3) {
        throw new SyntaxError();
    }
    const [condition, ifDo, elseDo] = args;
    const value = evaluate(condition, env);
    if (value) {
        evaluate(ifDo, env);
    } else if (elseDo) {
        evaluate(elseDo, env);
    }
}

special['func'] = (args, env) => {
    const newEnv = Object.create(env);
    env[args[0].name] = () => evaluate(args[1], newEnv);
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

    let closer;
    if (rest[0] === '{') {
        closer = '}';
    } else {
        closer = ')';
    }

    const expression = { type: 'apply', operator: expr, args: [] };

    rest = removeWhitespace(rest.slice(1));

    if (closer === '}') {
        while (rest[0] !== '}') {
            const arg = parseExpression(rest);
            expression.args.push(arg.expression);
            rest = removeWhitespace(arg.rest);
        }
        return parseApply(expression, rest.slice(1));
    }

    if (closer === ')') {
        while (rest[0] !== ')') {
            const arg = parseExpression(rest);
            expression.args.push(arg.expression);
            rest = removeWhitespace(arg.rest);
            if (rest[0] === ',') {
                rest = removeWhitespace(rest.slice(1));
            } else if (rest[0] !== ')') {
                console.log(rest);
                throw new SyntaxError();
            }
        }
        return parseApply(expression, rest.slice(1));
    }
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
            if (expression.operator.type === "word" && expression.operator.name in special) {
                return special[expression.operator.name](expression.args, env);
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
if(<=(1,0), { print("haha") }, { print("hoho") })
`);

run(`
put(a, 5)
func(haha, {
put(a, 6)
print(a)
})
haha()
print(a)
`);
