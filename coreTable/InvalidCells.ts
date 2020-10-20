// Previously when we get a blank for a value, or a string where we expect a number, etc, we parse things as simply
// undefineds or nulls or NaN.
// Since authors are uploading data from our sources at runtime, and errors in source data are extremely common,
// it may be helpful to parse those invalid values into specific types, to provide better error messages
// and perhaps in the future suggested autocorrections or workarounds. Or this could be a dumb idea and can be discarded.
export abstract class InvalidCell {
    toString() {
        return ""
    }
    toErrorString() {
        return this.constructor.name
    }
}

class NaNButShouldBeNumber extends InvalidCell {}
class DroppedForTesting extends InvalidCell {}
class InvalidOnALogScale extends InvalidCell {}
class UndefinedButShouldBeNumber extends InvalidCell {}
class NullButShouldBeNumber extends InvalidCell {}
class BlankButShouldBeNumber extends InvalidCell {}
class UndefinedButShouldBeString extends InvalidCell {}
class NullButShouldBeString extends InvalidCell {}
class NotAParseableNumberButShouldBeNumber extends InvalidCell {}

export const InvalidCellTypes = {
    NaNButShouldBeNumber: new NaNButShouldBeNumber(),
    DroppedForTesting: new DroppedForTesting(),
    InvalidOnALogScale: new InvalidOnALogScale(),
    UndefinedButShouldBeNumber: new UndefinedButShouldBeNumber(),
    NullButShouldBeNumber: new NullButShouldBeNumber(),
    BlankButShouldBeNumber: new BlankButShouldBeNumber(),
    UndefinedButShouldBeString: new UndefinedButShouldBeString(),
    NullButShouldBeString: new NullButShouldBeString(),
    NotAParseableNumberButShouldBeNumber: new NotAParseableNumberButShouldBeNumber(),
}
