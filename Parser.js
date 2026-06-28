/**
 * parser.js
 */

// Error codes pulled in from the shared CONFIG object (see config.js).
// Falling back to literals here too, in case this file gets loaded standalone
// or before CONFIG exists, so it never throws on a missing global.
const ERRORS = (typeof CONFIG !== "undefined" && CONFIG.ERRORS) || {
  CIRCULAR: "#CIRCULAR!",
  DIV_ZERO: "#DIV/0!",
  VALUE: "#VALUE!",
  SYNTAX: "#ERROR!",
}

const TOKEN_TYPES = {
  NUMBER: "NUMBER",
  REF: "REF", // single cell, e.g. A1
  RANGE: "RANGE", // A1:A5, only valid as a function argument
  OP: "OP",
  LPAREN: "LPAREN",
  RPAREN: "RPAREN",
  COMMA: "COMMA",
  FUNC: "FUNC", // SUM / AVG
};

const CELL_REF_RE = /^[A-Za-z]+[0-9]+/;
const FUNC_NAME_RE = /^[A-Za-z]+(?=\()/; // letters immediately followed by "("

function tokenize(input) {
  const tokens = [];
  let i = 0;
  const s = input;

  while (i < s.length) {
    const ch = s[i];

    // Skip whitespace
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (ch === "(") {
      tokens.push({ type: TOKEN_TYPES.LPAREN });
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ type: TOKEN_TYPES.RPAREN });
      i++;
      continue;
    }
    if (ch === ",") {
      tokens.push({ type: TOKEN_TYPES.COMMA });
      i++;
      continue;
    }

    // Operators
    if ("+-*/".includes(ch)) {
      tokens.push({ type: TOKEN_TYPES.OP, value: ch });
      i++;
      continue;
    }


    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(s[i + 1] || ""))) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      const raw = s.slice(i, j);
      if (raw.split(".").length > 2) {
        throw new SyntaxParseError(`Malformed number "${raw}"`);
      }
      tokens.push({ type: TOKEN_TYPES.NUMBER, value: parseFloat(raw) });
      i = j;
      continue;
    }

    if (/[A-Za-z]/.test(ch)) {
      const rest = s.slice(i);

      const funcMatch = rest.match(FUNC_NAME_RE);
      if (funcMatch) {
        tokens.push({ type: TOKEN_TYPES.FUNC, value: funcMatch[0].toUpperCase() });
        i += funcMatch[0].length;
        continue;
      }

      const refMatch = rest.match(CELL_REF_RE);
      if (!refMatch) {
        throw new SyntaxParseError(`Unrecognised text "${rest.slice(0, 5)}"`);
      }
      const firstRef = refMatch[0];
      i += firstRef.length;

    
      if (s[i] === ":") {
        const afterColon = s.slice(i + 1);
        const secondMatch = afterColon.match(CELL_REF_RE);
        if (!secondMatch) {
          throw new SyntaxParseError(`Bad range starting at "${firstRef}:"`);
        }
        tokens.push({
          type: TOKEN_TYPES.RANGE,
          value: `${firstRef.toUpperCase()}:${secondMatch[0].toUpperCase()}`,
        });
        i += 1 + secondMatch[0].length;
        continue;
      }

      tokens.push({ type: TOKEN_TYPES.REF, value: firstRef.toUpperCase() });
      continue;
    }


    throw new SyntaxParseError(`Unexpected character "${ch}"`);
  }

  return tokens;
}


class SyntaxParseError extends Error {}

function parse(tokens) {
  let pos = 0;

  function peek() {
    return tokens[pos];
  }

  function consume(expectedType) {
    const tok = tokens[pos];
    if (!tok || tok.type !== expectedType) {
      throw new SyntaxParseError(
        `Expected ${expectedType} but got ${tok ? tok.type : "end of formula"}`
      );
    }
    pos++;
    return tok;
  }

  function parseExpression() {
    let node = parseTerm();
    while (peek() && peek().type === TOKEN_TYPES.OP && (peek().value === "+" || peek().value === "-")) {
      const op = consume(TOKEN_TYPES.OP).value;
      const right = parseTerm();
      node = { type: "BinOp", op, left: node, right };
    }
    return node;
  }

  function parseTerm() {
    let node = parseFactor();
    while (peek() && peek().type === TOKEN_TYPES.OP && (peek().value === "*" || peek().value === "/")) {
      const op = consume(TOKEN_TYPES.OP).value;
      const right = parseFactor();
      node = { type: "BinOp", op, left: node, right };
    }
    return node;
  }

  function parseFactor() {
    const tok = peek();
    if (!tok) {
      throw new SyntaxParseError("Unexpected end of formula");
    }

    if (tok.type === TOKEN_TYPES.NUMBER) {
      consume(TOKEN_TYPES.NUMBER);
      return { type: "Number", value: tok.value };
    }

    if (tok.type === TOKEN_TYPES.REF) {
      consume(TOKEN_TYPES.REF);
      return { type: "Ref", value: tok.value };
    }

    if (tok.type === TOKEN_TYPES.LPAREN) {
      consume(TOKEN_TYPES.LPAREN);
      const inner = parseExpression();
      consume(TOKEN_TYPES.RPAREN);
      return inner;
    }

    if (tok.type === TOKEN_TYPES.FUNC) {
      return parseFunctionCall();
    }


    if (tok.type === TOKEN_TYPES.OP && tok.value === "-") {
      consume(TOKEN_TYPES.OP);
      const operand = parseFactor();
      return { type: "UnaryMinus", operand };
    }

    throw new SyntaxParseError(`Unexpected token "${tok.value ?? tok.type}"`);
  }

  function parseFunctionCall() {
    const name = consume(TOKEN_TYPES.FUNC).value;
    if (!["SUM", "AVG"].includes(name)) {
      throw new SyntaxParseError(`Unknown function "${name}"`);
    }
    consume(TOKEN_TYPES.LPAREN);

    const argTok = peek();
    let rangeValue;
    if (argTok && argTok.type === TOKEN_TYPES.RANGE) {
      rangeValue = consume(TOKEN_TYPES.RANGE).value;
    } else if (argTok && argTok.type === TOKEN_TYPES.REF) {
      // Allow SUM(A1) as a degenerate one-cell "range" too
      const ref = consume(TOKEN_TYPES.REF).value;
      rangeValue = `${ref}:${ref}`;
    } else {
      throw new SyntaxParseError(`${name}() expects a range like A1:A5`);
    }

    consume(TOKEN_TYPES.RPAREN);
    return { type: "FuncCall", name, range: rangeValue };
  }

  const ast = parseExpression();
  if (pos !== tokens.length) {

    throw new SyntaxParseError("Unexpected trailing tokens");
  }
  return ast;
}


function expandRange(rangeStr) {
  const [startRef, endRef] = rangeStr.split(":");
  const start = splitRef(startRef);
  const end = splitRef(endRef);

  const colStart = Math.min(start.col, end.col);
  const colEnd = Math.max(start.col, end.col);
  const rowStart = Math.min(start.row, end.row);
  const rowEnd = Math.max(start.row, end.row);

  const cells = [];
  for (let col = colStart; col <= colEnd; col++) {
    for (let row = rowStart; row <= rowEnd; row++) {
      cells.push(colToLetter(col) + row);
    }
  }
  return cells;
}

function splitRef(ref) {
  const match = ref.match(/^([A-Za-z]+)([0-9]+)$/);
  if (!match) throw new SyntaxParseError(`Bad cell reference "${ref}"`);
  return { col: letterToCol(match[1]), row: parseInt(match[2], 10) };
}


function letterToCol(letters) {
  let col = 0;
  for (const ch of letters.toUpperCase()) {
    col = col * 26 + (ch.charCodeAt(0) - 64);
  }
  return col;
}

function colToLetter(col) {
  let letters = "";
  while (col > 0) {
    const rem = (col - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    col = Math.floor((col - 1) / 26);
  }
  return letters;
}



class CellError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function toNumber(raw) {
  if (raw === undefined || raw === null || raw === "") return 0;
  if (typeof raw === "number") return raw;
  if (typeof raw === "string" && raw.trim() !== "" && !isNaN(raw)) {
    return parseFloat(raw);
  }
  
  throw new CellError(ERRORS.VALUE);
}

function evalNode(node, getCellValue, deps) {
  switch (node.type) {
    case "Number":
      return node.value;

    case "UnaryMinus":
      return -evalNode(node.operand, getCellValue, deps);

    case "Ref": {
      deps.add(node.value);
      const cell = getCellValue(node.value);
      if (cell && cell.error) throw new CellError(cell.error);
      return toNumber(cell ? cell.value : undefined);
    }

    case "BinOp": {
      const left = evalNode(node.left, getCellValue, deps);
      const right = evalNode(node.right, getCellValue, deps);
      switch (node.op) {
        case "+":
          return left + right;
        case "-":
          return left - right;
        case "*":
          return left * right;
        case "/":
          if (right === 0) throw new CellError(ERRORS.DIV_ZERO);
          return left / right;
        default:
          throw new CellError(ERRORS.SYNTAX);
      }
    }

    case "FuncCall": {
      const refs = expandRange(node.range);
      const values = refs.map((ref) => {
        deps.add(ref);
        const cell = getCellValue(ref);
        if (cell && cell.error) throw new CellError(cell.error);
        return toNumber(cell ? cell.value : undefined);
      });
      if (node.name === "SUM") {
        return values.reduce((a, b) => a + b, 0);
      }
      if (node.name === "AVG") {
        if (values.length === 0) throw new CellError(ERRORS.SYNTAX);
        return values.reduce((a, b) => a + b, 0) / values.length;
      }
      throw new CellError(ERRORS.SYNTAX);
    }

    default:
      throw new CellError(ERRORS.SYNTAX);
  }
}


function evaluateFormula(formulaText, getCellValue) {
  const deps = new Set();
  try {
    const tokens = tokenize(formulaText);
    const ast = parse(tokens);
    const value = evalNode(ast, getCellValue, deps);
    return { value, error: null, deps };
  } catch (err) {
    if (err instanceof CellError) {
      return { value: null, error: err.code, deps };
    }
    if (err instanceof SyntaxParseError) {
      return { value: null, error: ERRORS.SYNTAX, deps };
    }
    
    return { value: null, error: ERRORS.SYNTAX, deps };
  }
}


window.FormulaParser = {
  evaluateFormula,
  expandRange, // exported too: engine.js's dependency graph code may want
  // this directly when re-checking ranges without re-parsing.
};
