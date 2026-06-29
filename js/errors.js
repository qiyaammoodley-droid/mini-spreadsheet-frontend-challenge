
const SPREADSHEET_ERRORS = {
  CIRCULAR: "#CIRCULAR!",
  DIV_ZERO: "#DIV/0!",
  VALUE: "#VALUE!",
  SYNTAX: "#ERROR!"
};


class CellError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
    this.name = "CellError";
  }
}

class SyntaxParseError extends Error {
  constructor(message) {
    super(message);
    this.name = "SyntaxParseError";
  }
}


function isSpreadsheetError(val) {
  const errorTokens = Object.values(SPREADSHEET_ERRORS);
  if (Array.isArray(val)) {
    return val.find(item => errorTokens.includes(item)) || null;
  }
  return errorTokens.includes(val) ? val : null;
}


window.SPREADSHEET_ERRORS = SPREADSHEET_ERRORS;
window.CellError = CellError;
window.SyntaxParseError = SyntaxParseError;
window.isSpreadsheetError = isSpreadsheetError;