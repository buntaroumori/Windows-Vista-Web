const finite = (number) => {
  if (!Number.isFinite(number) || Math.abs(number) > 1e100)
    throw new Error('No se puede realizar esta operación');
  return Number(number.toPrecision(13));
};

export class Calculator {
  constructor() {
    this.memory = 0;
    this.clear();
  }
  clear() {
    this.input = '0';
    this.accumulator = null;
    this.operator = null;
    this.overwrite = true;
    this.lastOperator = null;
    this.lastOperand = null;
    this.error = false;
  }
  get number() {
    return Number(this.input);
  }
  get display() {
    return this.error ? this.input : this.input.replace('.', ',');
  }
  calculate(a, op, b) {
    if (op === '/' && b === 0) throw new Error('No se puede dividir entre cero');
    return finite(
      op === '+'
        ? a + b
        : op === '-'
          ? a - b
          : op === '*'
            ? a * b
            : op === '/'
              ? a / b
              : op === '^'
                ? a ** b
                : b,
    );
  }
  press(key) {
    if (key === 'C') {
      this.clear();
      return;
    }
    if (this.error && /^\d$|^\.$|^CE$/.test(key)) this.clear();
    if (this.error) return;
    try {
      if (/^\d$/.test(key)) {
        if (this.overwrite && !this.operator) {
          this.lastOperator = null;
          this.lastOperand = null;
        }
        if (this.overwrite || this.input === '0') this.input = key;
        else if (this.input.replace(/[-.]/g, '').length < 15) this.input += key;
        this.overwrite = false;
      } else if (key === '.') {
        if (this.overwrite) this.input = '0';
        if (!this.input.includes('.')) this.input += '.';
        this.overwrite = false;
      } else if (['+', '-', '*', '/', '^'].includes(key)) {
        if (this.operator && !this.overwrite)
          this.input = String(this.calculate(this.accumulator, this.operator, this.number));
        this.accumulator = this.number;
        this.operator = key;
        this.overwrite = true;
        this.lastOperator = null;
      } else if (key === '=') {
        if (this.operator) {
          this.lastOperator = this.operator;
          this.lastOperand = this.number;
          this.input = String(this.calculate(this.accumulator, this.operator, this.number));
          this.operator = null;
        } else if (this.lastOperator)
          this.input = String(this.calculate(this.number, this.lastOperator, this.lastOperand));
        this.overwrite = true;
      } else if (key === 'CE') {
        this.input = '0';
        this.overwrite = true;
      } else if (key === 'Backspace') {
        if (!this.overwrite) this.input = this.input.length > 1 ? this.input.slice(0, -1) : '0';
        if (this.input === '-') this.input = '0';
      } else if (key === 'sign') {
        if (this.number !== 0)
          this.input = this.input.startsWith('-') ? this.input.slice(1) : `-${this.input}`;
      } else if (key === '%') {
        this.input = String(
          finite(
            this.operator === '+' || this.operator === '-'
              ? (this.accumulator * this.number) / 100
              : this.number / 100,
          ),
        );
        this.overwrite = true;
      } else if (key === 'sqrt') {
        if (this.number < 0) throw new Error('Entrada no válida');
        this.input = String(finite(Math.sqrt(this.number)));
        this.overwrite = true;
      } else if (key === 'inv') {
        if (this.number === 0) throw new Error('No se puede dividir entre cero');
        this.input = String(finite(1 / this.number));
        this.overwrite = true;
      } else if (key === 'MC') this.memory = 0;
      else if (key === 'MR') {
        this.input = String(this.memory);
        this.overwrite = true;
      } else if (key === 'MS') {
        this.memory = this.number;
        this.overwrite = true;
      } else if (key === 'M+') {
        this.memory = finite(this.memory + this.number);
        this.overwrite = true;
      } else if (key === 'pi') {
        this.input = String(finite(Math.PI));
        this.overwrite = true;
      } else if (['sin', 'cos', 'tan', 'log', 'ln', 'square'].includes(key)) {
        const n = this.number;
        this.input = String(
          finite(
            key === 'square'
              ? n * n
              : key === 'log'
                ? Math.log10(n)
                : key === 'ln'
                  ? Math.log(n)
                  : Math[key]((n * Math.PI) / 180),
          ),
        );
        this.overwrite = true;
      }
    } catch (error) {
      this.input = error.message;
      this.error = true;
      this.operator = null;
      this.overwrite = true;
    }
  }
}
