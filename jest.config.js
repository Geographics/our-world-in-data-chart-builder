module.exports = {
    testTimeout: 1000,
    projects: [
        {
            displayName: { name: "node", color: "magenta" },
            testEnvironment: "node",
            testPathIgnorePatterns: [".jsdom.test."],
            testMatch: ["**/*.test.(jsx|js)"],
            modulePathIgnorePatterns: ["<rootDir>/wordpress/"],
        },
        {
            displayName: { name: "jsdom", color: "cyan" },
            testEnvironment: "jsdom",
            testMatch: ["**/*.jsdom.test.(jsx|js)"],
            // modulePathIgnorePatterns: ["<rootDir>/wordpress/"],
        },
    ],
}
