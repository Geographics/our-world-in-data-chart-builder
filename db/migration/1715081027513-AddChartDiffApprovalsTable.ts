import { MigrationInterface, QueryRunner } from "typeorm"

export class AddChartDiffApprovalsTable1715081027513
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            CREATE TABLE chart_diff_approvals (
                id integer NOT NULL AUTO_INCREMENT,
                chartId integer NOT NULL,
                sourceUpdatedAt datetime NOT NULL,
                targetUpdatedAt datetime DEFAULT NULL,
                updatedAt datetime NOT NULL,
                status varchar(255) NOT NULL,

                FOREIGN KEY (chartId) REFERENCES charts (id) ON DELETE CASCADE ON UPDATE CASCADE,

                PRIMARY KEY (id),

                INDEX (chartId)
            )
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE chart_diff_approvals`)
    }
}
