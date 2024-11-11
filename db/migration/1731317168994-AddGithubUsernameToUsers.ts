import { MigrationInterface, QueryRunner } from "typeorm"

export class AddGithubUsernameToUsers1731317168994
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add 'githubUsername' column using raw SQL
        await queryRunner.query(`
            ALTER TABLE users ADD COLUMN githubUsername VARCHAR(255) NULL;
        `)

        // Set 'githubUsername' = 'fullName' by default
        await queryRunner.query(`
            UPDATE users
            SET githubUsername = fullName;
        `)

        // Update 'githubUsername' for specific users
        const updates = [
            { fullName: "Bastian Herre", githubUsername: "bastianherre" },
            { fullName: "Marwa Boukarim", githubUsername: "mrwbkrm" },
            {
                fullName: "Natalie Reynolds-Garcia",
                githubUsername: "natreygar",
            },
            { fullName: "Max Roser", githubUsername: "Max" },
            { fullName: "Valerie Muigai", githubUsername: "ValRMuigai" },
        ]

        for (const { fullName, githubUsername } of updates) {
            await queryRunner.query(
                `
            UPDATE users
            SET githubUsername = ?
            WHERE fullName = ?;
            `,
                [githubUsername, fullName]
            )
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove 'githubUsername' column using raw SQL
        await queryRunner.query(`
            ALTER TABLE users DROP COLUMN githubUsername;
        `)
    }
}
