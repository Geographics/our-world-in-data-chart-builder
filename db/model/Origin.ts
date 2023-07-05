import { Entity, PrimaryGeneratedColumn, Column, BaseEntity } from "typeorm"

@Entity("origins")
export class Origin extends BaseEntity {
    @PrimaryGeneratedColumn() id!: number
    @Column({ type: "varchar", nullable: true }) datasetTitleOwid!:
        | string
        | null
    @Column({ type: "text", nullable: true }) datasetDescriptionOwid!:
        | string
        | null
    @Column({ type: "text", nullable: true }) datasetDescriptionProducer!:
        | string
        | null
    @Column({ type: "varchar", nullable: true }) producer!: string | null
    @Column({ type: "text", nullable: true }) citationProducer!: string | null
    @Column({ type: "text", nullable: true }) datasetUrlMain!: string | null
    @Column({ type: "text", nullable: true }) datasetUrlDownload!: string | null
    @Column({ type: "date", nullable: true }) dateAccessed!: Date | null
    @Column({ type: "varchar", nullable: true }) datePublished!: string | null
}
