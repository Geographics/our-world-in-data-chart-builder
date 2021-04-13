import { Color } from "../../coreTable/CoreTableConstants"

interface BinProps {
    readonly color: Color
    readonly label?: string
}

interface NumericBinProps extends BinProps {
    readonly isFirst: boolean
    readonly isOpenLeft: boolean
    readonly isOpenRight: boolean
    readonly min: number
    readonly max: number
    readonly displayMin: string
    readonly displayMax: string
}

interface CategoricalBinProps extends BinProps {
    readonly index: number
    readonly value: string
    readonly label: string
    readonly isHidden?: boolean
}

abstract class AbstractColorScaleBin<T extends BinProps> {
    props: T
    constructor(props: T) {
        this.props = props
    }
    get color() {
        return this.props.color
    }
    get label() {
        return this.props.label
    }
}

export class NumericBin extends AbstractColorScaleBin<NumericBinProps> {
    get min() {
        return this.props.min
    }
    get max() {
        return this.props.max
    }
    get minText() {
        return (this.props.isOpenLeft ? `<` : "") + this.props.displayMin
    }
    get maxText() {
        return (this.props.isOpenRight ? `>` : "") + this.props.displayMax
    }
    get text() {
        return this.props.label || ""
    }
    get isHidden() {
        return false
    }

    contains(value: string | number | undefined) {
        if (value === undefined) return false

        if (this.props.isOpenLeft) return value <= this.max

        if (this.props.isOpenRight) return value > this.min

        if (this.props.isFirst) return value >= this.min && value <= this.max

        return value > this.min && value <= this.max
    }

    equals(other: ColorScaleBin) {
        return (
            other instanceof NumericBin &&
            this.min === other.min &&
            this.max === other.max
        )
    }
}

export class CategoricalBin extends AbstractColorScaleBin<CategoricalBinProps> {
    get index() {
        return this.props.index
    }
    get value() {
        return this.props.value
    }
    get isHidden() {
        return this.props.isHidden
    }

    get text() {
        return this.props.label || this.props.value
    }

    contains(value: string | number | undefined) {
        return (
            (value === undefined && this.props.value === "No data") ||
            (value !== undefined && value === this.props.value)
        )
    }

    equals(other: ColorScaleBin) {
        return (
            other instanceof CategoricalBin &&
            this.props.index === other.props.index
        )
    }
}

export type ColorScaleBin = CategoricalBin | NumericBin
