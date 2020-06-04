import { OwidVariable } from "charts/owidData/OwidVariable"

// Normally all variables come from the WP backend. In this attempt I try and generate variables client side.
// This map contains the meta data for these generated variables which they then can extend. There's the obvious
// issue that this file can get out of data with the WP backend. In addition, this approach is fine for simple
// transformations, but for generating slightly more complex variables like rolling windows with certain parameters,
// which are easy with Pandas, become not as simple if we have to roll our own data transformation library.
// We may want to revert to a Chart Builder that cannot generate variables on the fly.
export const variablePartials: { [name: string]: Partial<OwidVariable> } = {
    tests_per_case: {
        id: 142754,
        name: "short_term_tests_per_case",
        unit: "",
        description:
            "The number of tests each day divided by the number of confirmed cases each day.\n\nThe series is smoothed by averaging daily figures over a rolling 7-day window.\n\nNot all countries report testing data on a daily basis. To generate this series we assume that testing changed equally on a daily basis over any periods in which no data was reported.",
        coverage: "",
        display: {
            name: "Tests per confirmed case – daily",
            unit: "tests per confirmed case",
            yearIsDay: true,
            entityAnnotationsMap:
                "Argentina: tests performed\nAustralia: tests performed\nAustria: tests performed\nBahrain: units unclear\nBangladesh: samples tested\nBelarus: tests performed\nBelgium: units unclear\nBolivia: units unclear\nBrazil: tests performed\nBulgaria: tests performed\nCanada: people tested\nChile: tests performed\nColombia: samples tested\nCosta Rica: people tested\nCroatia: people tested\nCuba: tests performed\nCzech Republic: tests performed\nDenmark: people tested\nEcuador: units unclear\nEl Salvador: tests performed\nEstonia: tests performed\nEthiopia: tests performed\nFinland: samples tested\nFrance: people tested\nGermany: tests performed\nGhana: people tested\nGreece: tests performed\nHong Kong: tests performed\nHungary: tests performed\nIceland: samples tested\nIndia: samples tested\nIndonesia: people tested\nIran: tests performed\nIreland: units unclear\nIsrael: tests performed\nItaly: tests performed\nJapan: people tested\nKazakhstan: tests performed\nKenya: units unclear\nLatvia: tests performed\nLithuania: samples tested\nLuxembourg: people tested\nMalaysia: people tested\nMaldives: samples tested\nMexico: people tested\nMorocco: people tested\nMyanmar: samples tested\nNepal: people tested\nNetherlands: people tested\nNew Zealand: tests performed\nNigeria: samples tested\nNorway: people tested\nPakistan: tests performed\nPanama: units unclear\nParaguay: samples tested\nPeru: people tested\nPhilippines: people tested\nPoland: samples tested\nPortugal: samples tested\nQatar: people tested\nRomania: tests performed\nRussia: tests performed\nRwanda: units unclear\nSaudi Arabia: units unclear\nSenegal: tests performed\nSerbia: people tested\nSingapore: people tested\nSlovakia: tests performed\nSlovenia: tests performed\nSouth Africa: units unclear\nSouth Korea: people tested\nSpain: tests performed\nSweden: people tested\nSwitzerland: tests performed\nTaiwan: tests performed\nThailand: samples tested\nTunisia: units unclear\nTurkey: tests performed\nUganda: samples tested\nUkraine: units unclear\nUnited Kingdom: tests performed\nUnited States: tests performed\nUruguay: tests performed\nVietnam: units unclear\nZimbabwe: tests performed\n"
        },
        datasetName: "COVID testing time series data",
        source: {
            id: 17805,
            name: "Official data collated by Our World in Data",
            dataPublishedBy:
                "For source details see ourworldindata.org/covid-testing#source-information-country-by-country",
            dataPublisherSource:
                "For source details see ourworldindata.org/covid-testing#source-information-country-by-country",
            link:
                "ourworldindata.org/covid-testing#source-information-country-by-country",
            retrievedDate: "",
            additionalInfo:
                "Data on COVID-19 testing. Comparisons between countries are compromised for several reasons.\n\nYou can download the full dataset, alongside detailed source descriptions here: https://github.com/owid/covid-19-data/tree/master/public/data/"
        }
    },
    case_fatality_rate: {
        id: 142600,
        name:
            "Case fatality rate of COVID-19 (%) (Only observations with ≥100 cases)",
        unit: "",
        description: "",
        coverage: "",
        display: { unit: "%", zeroDay: "2020-01-21", yearIsDay: true },
        datasetName: "COVID-2019 - ECDC (2020)",
        source: {
            id: 17801,
            name:
                "European CDC – Situation Update Worldwide – Last updated 3rd June, 11:00 (London time)",
            dataPublishedBy:
                "European Centre for Disease Prevention and Control (ECDC)",
            dataPublisherSource: "",
            link:
                "https://github.com/owid/covid-19-data/tree/master/public/data",
            retrievedDate: "",
            additionalInfo:
                'Raw data on confirmed cases and deaths for all countries is sourced from the <a href="https://www.ecdc.europa.eu/en/publications-data/download-todays-data-geographic-distribution-covid-19-cases-worldwide">European Centre for Disease Prevention and Control (ECDC)</a>.  \n\nOur complete COVID-19 dataset is a collection of the COVID-19 data maintained by <em>Our World in Data</em>. <strong>It is updated daily</strong> and includes data on confirmed cases, deaths, and testing.\n\nWe have created a new description of all our data sources. You find it at our GitHub repository <strong><a href="https://github.com/owid/covid-19-data/tree/master/public/data/">here</a></strong>. There you can download all of our data.\n\n'
        }
    },
    cases: {
        id: 142581,
        name: "Confirmed cases of COVID-19",
        unit: "",
        description: "",
        coverage: "",
        display: {
            name: "confirmed cases",
            unit: "cases",
            zeroDay: "2020-01-21",
            yearIsDay: true,
            numDecimalPlaces: 0
        },
        datasetName: "COVID-2019 - ECDC (2020)",
        source: {
            id: 17801,
            name: "European CDC – Situation Update Worldwide",
            dataPublishedBy:
                "European Centre for Disease Prevention and Control (ECDC)",
            dataPublisherSource: "",
            link: "https://github.com/owid/covid-19-data",
            retrievedDate: "",
            additionalInfo:
                'Raw data on confirmed cases and deaths for all countries is sourced from the <a href="https://www.ecdc.europa.eu/en/publications-data/download-todays-data-geographic-distribution-covid-19-cases-worldwide">European Centre for Disease Prevention and Control (ECDC)</a>.  \n\nOur complete COVID-19 dataset is a collection of the COVID-19 data maintained by <em>Our World in Data</em>. <strong>It is updated daily</strong> and includes data on confirmed cases, deaths, and testing.\n\nWe have created a new description of all our data sources. You find it at our GitHub repository <strong><a href="https://github.com/owid/covid-19-data/tree/master/public/data/">here</a></strong>. There you can download all of our data.\n\n'
        }
    },
    deaths: {
        id: 142583,
        name: "Confirmed deaths due to COVID-19",
        unit: "",
        description: "",
        coverage: "",
        display: {
            name: "confirmed deaths",
            unit: "deaths",
            zeroDay: "2020-01-21",
            yearIsDay: true,
            numDecimalPlaces: 0
        },
        datasetName: "COVID-2019 - ECDC (2020)",
        source: {
            id: 17801,
            name: "European CDC – Situation Update Worldwide",
            dataPublishedBy:
                "European Centre for Disease Prevention and Control (ECDC)",
            dataPublisherSource: "",
            link: "https://github.com/owid/covid-19-data",
            retrievedDate: "",
            additionalInfo:
                'Raw data on confirmed cases and deaths for all countries is sourced from the <a href="https://www.ecdc.europa.eu/en/publications-data/download-todays-data-geographic-distribution-covid-19-cases-worldwide">European Centre for Disease Prevention and Control (ECDC)</a>.  \n\nOur complete COVID-19 dataset is a collection of the COVID-19 data maintained by <em>Our World in Data</em>. <strong>It is updated daily</strong> and includes data on confirmed cases, deaths, and testing.\n\nWe have created a new description of all our data sources. You find it at our GitHub repository <strong><a href="https://github.com/owid/covid-19-data/tree/master/public/data/">here</a></strong>. There you can download all of our data.\n\n'
        }
    },
    tests: {
        id: 142601,
        name: "tests",
        unit: "",
        description: "",
        coverage: "",
        datasetId: "covid",
        shortUnit: "",
        display: {
            name: "tests",
            yearIsDay: true,
            numDecimalPlaces: 0
        },
        datasetName: "COVID testing time series data",
        source: {
            id: 17805,
            name: "Official data collated by Our World in Data",
            dataPublishedBy:
                "For source details see ourworldindata.org/covid-testing#source-information-country-by-country",
            dataPublisherSource:
                "For source details see ourworldindata.org/covid-testing#source-information-country-by-country",
            link:
                "ourworldindata.org/covid-testing#source-information-country-by-country",
            retrievedDate: "",
            additionalInfo:
                "Data on COVID-19 testing. Comparisons between countries are compromised for several reasons.\n\nYou can download the full dataset, alongside detailed source descriptions here: https://github.com/owid/covid-19-data/tree/master/public/data/testing"
        }
    },
    days_since: {
        id: 99999,
        name: "",
        unit: "",
        description: "",
        coverage: "",
        shortUnit: "",
        display: {
            zeroDay: "2020-01-21",
            yearIsDay: true,
            numDecimalPlaces: 0
        },
        datasetName: "COVID-2019 - ECDC (2020)",
        source: {
            id: 17801,
            name: "European CDC – Situation Update Worldwide",
            dataPublishedBy:
                "European Centre for Disease Prevention and Control (ECDC)",
            dataPublisherSource: "",
            link: "https://github.com/owid/covid-19-data",
            retrievedDate: "",
            additionalInfo:
                'Raw data on confirmed cases and deaths for all countries is sourced from the <a href="https://www.ecdc.europa.eu/en/publications-data/download-todays-data-geographic-distribution-covid-19-cases-worldwide">European Centre for Disease Prevention and Control (ECDC)</a>.  \n\nOur complete COVID-19 dataset is a collection of the COVID-19 data maintained by <em>Our World in Data</em>. <strong>It is updated daily</strong> and includes data on confirmed cases, deaths, and testing.\n\nWe have created a new description of all our data sources. You find it at our GitHub repository <strong><a href="https://github.com/owid/covid-19-data/tree/master/public/data/">here</a></strong>. There you can download all of our data.\n\n'
        }
    },
    continents: {
        id: 123,
        name: "Countries Continents",
        unit: "",
        description: "Countries and their associated continents.",
        coverage: "",
        shortUnit: "",
        display: {},
        datasetName: "Countries Continents",
        source: {
            id: 44,
            name: "Our World In Data",
            dataPublishedBy: "",
            dataPublisherSource: "",
            link: "",
            retrievedDate: "",
            additionalInfo: ""
        }
    }
}
