import { useContext, useEffect, useMemo, useState } from "react"
import * as React from "react"
import {
    Button,
    Card,
    Flex,
    Input,
    Modal,
    notification,
    Radio,
    Select,
    Space,
    Table,
} from "antd"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faCheck,
    faCopy,
    faPen,
    faSpinner,
    faUpload,
    faUpRightFromSquare,
} from "@fortawesome/free-solid-svg-icons"
import { faFigma } from "@fortawesome/free-brands-svg-icons"

import { AdminLayout } from "./AdminLayout.js"
import { Timeago } from "./Forms.js"
import { ColumnsType } from "antd/es/table/InternalTable.js"
import {
    buildSearchWordsFromSearchString,
    filterFunctionForSearchWords,
    highlightFunctionForSearchWords,
} from "../adminShared/search.js"
import {
    DbEnrichedImageWithUserId,
    DbPlainTag,
    OwidGdocDataInsightIndexItem,
} from "@ourworldindata/types"
import {
    copyToClipboard,
    dayjs,
    RequiredBy,
    startCase,
} from "@ourworldindata/utils"
import {
    CLOUDFLARE_IMAGES_URL,
    ENV,
    GRAPHER_DYNAMIC_THUMBNAIL_URL,
} from "../settings/clientSettings.js"
import { AdminAppContext } from "./AdminAppContext.js"
import { Admin } from "./Admin.js"
import { fileToBase64 } from "./imagesHelpers.js"

type NarrativeDataInsightIndexItem = RequiredBy<
    OwidGdocDataInsightIndexItem,
    "image" | "narrativeChart"
>

type UploadResponse =
    | { success: true; image: DbEnrichedImageWithUserId }
    | { success: false; errorMessage: string }

type PublicationFilter = "all" | "published" | "scheduled" | "draft"
type Layout = "list" | "gallery"

const DEFAULT_PUBLICATION_FILTER: PublicationFilter = "all"
const DEFAULT_LAYOUT: Layout = "list"

const editIcon = <FontAwesomeIcon icon={faPen} size="sm" />
const linkIcon = <FontAwesomeIcon icon={faUpRightFromSquare} size="sm" />
const uploadIcon = <FontAwesomeIcon icon={faUpload} size="sm" />
const spinnerIcon = <FontAwesomeIcon icon={faSpinner} spin />
const figmaIcon = <FontAwesomeIcon icon={faFigma} size="sm" />
const copyIcon = <FontAwesomeIcon icon={faCopy} size="sm" />
const checkIcon = <FontAwesomeIcon icon={faCheck} />

const NotificationContext = React.createContext(null)

function createColumns(ctx: {
    highlightFn: (
        text: string | null | undefined
    ) => React.ReactElement | string
    triggerImageUploadFlow: (dataInsight: NarrativeDataInsightIndexItem) => void
}): ColumnsType<OwidGdocDataInsightIndexItem> {
    return [
        {
            title: "Preview",
            key: "preview",
            render: (_, dataInsight) =>
                hasImage(dataInsight) ? (
                    <>
                        <img
                            className="border"
                            src={makePreviewImageSrc(dataInsight)}
                            style={{ maxWidth: 200 }}
                        />
                        <Button
                            type="text"
                            size="small"
                            icon={copyIcon}
                            onClick={() =>
                                copyToClipboard(dataInsight.image.filename)
                            }
                        >
                            Copy filename
                        </Button>
                    </>
                ) : undefined,
        },
        {
            title: "Title",
            dataIndex: "title",
            key: "title",
            width: 300,
            render: (title) => ctx.highlightFn(title),
        },
        {
            title: "Authors",
            dataIndex: "authors",
            key: "authors",
            width: 150,
            render: (authors: string[], dataInsight) => (
                <>
                    {authors.map((author, index) => (
                        <React.Fragment key={author}>
                            {ctx.highlightFn(author)}
                            {index < authors.length - 1 ? ", " : ""}
                        </React.Fragment>
                    ))}
                    {dataInsight.approvedBy &&
                        ` (approved by ${dataInsight.approvedBy})`}
                </>
            ),
        },
        {
            title: "Topic tags",
            dataIndex: "tags",
            key: "tags",
            render: (tags: DbPlainTag[]) =>
                tags.map((tag) => (
                    <a
                        key={tag.name}
                        href={`/admin/tags/${tag.id}`}
                        target="_blank"
                        rel="noreferrer noopener"
                        style={{ display: "block" }}
                    >
                        {ctx.highlightFn(tag.name)}
                    </a>
                )),
        },
        {
            title: "Chart type",
            dataIndex: "chartType",
            key: "chartType",
            width: 150,
            render: (chartType) => ctx.highlightFn(startCase(chartType)),
        },
        {
            title: "Published",
            dataIndex: "publishedAt",
            key: "publishedAt",
            render: (publishedAt) => {
                if (!publishedAt) return undefined
                const publicationDate = dayjs(publishedAt)
                const isScheduledForPublication =
                    publicationDate.isAfter(dayjs())
                if (isScheduledForPublication)
                    return (
                        <>
                            Scheduled for publication{" "}
                            <Timeago time={publishedAt} />
                        </>
                    )
                return (
                    <>
                        Published <Timeago time={publishedAt} />
                    </>
                )
            },
        },
        {
            title: "Links",
            key: "links",
            render: (_, dataInsight) => (
                <Space size="small" direction="vertical">
                    <Button
                        href={makePreviewLink(dataInsight)}
                        target="_blank"
                        icon={linkIcon}
                    >
                        Preview
                    </Button>
                    {dataInsight.grapherUrl && (
                        <Button
                            href={dataInsight.grapherUrl}
                            target="_blank"
                            icon={linkIcon}
                        >
                            Grapher page
                        </Button>
                    )}
                    {dataInsight.explorerUrl && (
                        <Button
                            href={dataInsight.explorerUrl}
                            target="_blank"
                            icon={linkIcon}
                        >
                            Explorer view
                        </Button>
                    )}
                    {dataInsight.figmaUrl && (
                        <Button
                            href={dataInsight.figmaUrl}
                            target="_blank"
                            icon={figmaIcon}
                        >
                            Figma
                        </Button>
                    )}
                </Space>
            ),
        },
        {
            title: "Actions",
            key: "actions",
            render: (_, dataInsight) => (
                <Space size="small" direction="vertical">
                    <Button
                        type="primary"
                        target="_blank"
                        href={makeGDocEditLink(dataInsight)}
                        icon={editIcon}
                    >
                        Edit GDoc
                    </Button>
                    {hasNarrativeChart(dataInsight) && (
                        <Button
                            type="primary"
                            href={makeNarrativeChartEditLink(dataInsight)}
                            target="_blank"
                            icon={editIcon}
                        >
                            Edit narrative chart
                        </Button>
                    )}
                    {canReuploadImage(dataInsight) && (
                        <Button
                            icon={uploadIcon}
                            onClick={() =>
                                ctx.triggerImageUploadFlow(dataInsight)
                            }
                        >
                            Reupload image
                        </Button>
                    )}
                </Space>
            ),
        },
    ]
}

export function DataInsightIndexPage() {
    const { admin } = useContext(AdminAppContext)

    const [dataInsights, setDataInsights] = useState<
        OwidGdocDataInsightIndexItem[]
    >([])

    const [searchValue, setSearchValue] = useState("")
    const [publicationFilter, setPublicationFilter] =
        useState<PublicationFilter>(DEFAULT_PUBLICATION_FILTER)
    const [layout, setLayout] = useState<Layout>(DEFAULT_LAYOUT)

    const [dataInsightForImageUpload, setDataInsightForImageUpload] =
        useState<NarrativeDataInsightIndexItem>()
    const [isImageUploadInProgress, setIsImageUploadInProgress] =
        useState(false)

    const [notificationApi, notificationContextHolder] =
        notification.useNotification()

    const searchWords = useMemo(
        () => buildSearchWordsFromSearchString(searchValue),
        [searchValue]
    )

    const filteredDataInsights = useMemo(() => {
        const publicationFilterFn = (
            dataInsight: OwidGdocDataInsightIndexItem
        ) => {
            switch (publicationFilter) {
                case "draft":
                    return !dataInsight.published
                case "scheduled":
                    return (
                        dataInsight.published &&
                        dayjs(dataInsight.publishedAt).isAfter(dayjs())
                    )
                case "published":
                    return (
                        dataInsight.published &&
                        dayjs(dataInsight.publishedAt).isBefore(dayjs())
                    )
                case "all":
                    return true
            }
        }
        const searchFilterFn = filterFunctionForSearchWords(
            searchWords,
            (dataInsight: OwidGdocDataInsightIndexItem) => [
                dataInsight.title,
                dataInsight.slug,
                startCase(dataInsight.chartType),
                ...(dataInsight.tags ?? []).map((tag) => tag.name),
                ...dataInsight.authors,
                dataInsight.markdown ?? "",
            ]
        )

        return dataInsights.filter(publicationFilterFn).filter(searchFilterFn)
    }, [dataInsights, publicationFilter, searchWords])

    const highlightFn = useMemo(
        () => highlightFunctionForSearchWords(searchWords),
        [searchWords]
    )

    const columns = useMemo(() => {
        const triggerImageUploadFlow = (
            dataInsight: NarrativeDataInsightIndexItem
        ) => setDataInsightForImageUpload(dataInsight)

        return createColumns({
            highlightFn,
            triggerImageUploadFlow,
        })
    }, [highlightFn])

    useEffect(() => {
        const fetchAllDataInsights = async () =>
            (await admin.getJSON(
                "/api/dataInsights"
            )) as OwidGdocDataInsightIndexItem[]

        void fetchAllDataInsights().then((dataInsights) => {
            setDataInsights(dataInsights)
        })
    }, [admin])

    const updateDataInsightPreviewAfterImageUpload = (
        dataInsightId: string,
        uploadedImage: DbEnrichedImageWithUserId
    ) => {
        setDataInsights((dataInsights) =>
            dataInsights.map((dataInsight) =>
                dataInsight.id === dataInsightId
                    ? {
                          ...dataInsight,
                          image: dataInsight.image
                              ? {
                                    ...dataInsight.image,
                                    filename: uploadedImage.filename,
                                    cloudflareId: uploadedImage.cloudflareId,
                                    originalWidth: uploadedImage.originalWidth,
                                }
                              : undefined,
                      }
                    : dataInsight
            )
        )
    }

    const handleImageUpload = async (
        dataInsight: NarrativeDataInsightIndexItem
    ) => {
        setIsImageUploadInProgress(true)

        const response = await uploadChartViewImage(admin, dataInsight)

        if (response.success) {
            updateDataInsightPreviewAfterImageUpload(
                dataInsight.id,
                response.image
            )

            notificationApi.info({
                message: "Image replaced!",
                description:
                    "Make sure you update the alt text if your revision has substantive changes",
                placement: "bottomRight",
            })
        } else {
            notificationApi.warning({
                message: "Image upload failed",
                description: response?.errorMessage,
                placement: "bottomRight",
            })
        }

        setIsImageUploadInProgress(false)
        setDataInsightForImageUpload(undefined)
    }

    return (
        <AdminLayout title="Data insights">
            <NotificationContext.Provider value={null}>
                {notificationContextHolder}
                <main className="DataInsightIndexPage">
                    <Flex justify="space-between">
                        <Flex gap="small">
                            <Input
                                placeholder="Search"
                                value={searchValue}
                                onChange={(e) => setSearchValue(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Escape") setSearchValue("")
                                }}
                                style={{ width: 500, marginBottom: 20 }}
                            />
                            <Select
                                value={publicationFilter}
                                options={[
                                    { value: "all", label: "All" },
                                    { value: "draft", label: "Drafts" },
                                    { value: "published", label: "Published" },
                                    { value: "scheduled", label: "Scheduled" },
                                ]}
                                onChange={(value: PublicationFilter) =>
                                    setPublicationFilter(value)
                                }
                                popupMatchSelectWidth={false}
                            />
                            <Button
                                type="dashed"
                                onClick={() => {
                                    setSearchValue("")
                                    setPublicationFilter(
                                        DEFAULT_PUBLICATION_FILTER
                                    )
                                }}
                            >
                                Reset
                            </Button>
                        </Flex>
                        <Radio.Group
                            defaultValue="list"
                            onChange={(e) => setLayout(e.target.value)}
                        >
                            <Radio.Button value="list">List</Radio.Button>
                            <Radio.Button value="gallery">Gallery</Radio.Button>
                        </Radio.Group>
                    </Flex>
                    {layout === "list" && (
                        <Table
                            columns={columns}
                            dataSource={filteredDataInsights}
                            rowKey={(dataInsight) => dataInsight.id}
                        />
                    )}
                    {layout === "gallery" && (
                        <DataInsightGallery
                            dataInsights={filteredDataInsights}
                        />
                    )}
                    {dataInsightForImageUpload && (
                        <Modal
                            title="Upload narrative chart export as DI image"
                            open={dataInsightForImageUpload !== undefined}
                            width={765}
                            okText="Upload"
                            okButtonProps={{
                                icon: isImageUploadInProgress
                                    ? spinnerIcon
                                    : checkIcon,
                            }}
                            onOk={() =>
                                handleImageUpload(dataInsightForImageUpload)
                            }
                            onCancel={() =>
                                setDataInsightForImageUpload(undefined)
                            }
                        >
                            <UploadImageModalContent
                                dataInsight={dataInsightForImageUpload}
                            />
                        </Modal>
                    )}
                </main>
            </NotificationContext.Provider>
        </AdminLayout>
    )
}

function DataInsightGallery({
    dataInsights,
}: {
    dataInsights: OwidGdocDataInsightIndexItem[]
}) {
    const dataInsightsWithPreviewImage = dataInsights.filter((dataInsight) =>
        hasImage(dataInsight)
    )
    return (
        <Flex wrap gap="large">
            {dataInsightsWithPreviewImage.map((dataInsight) => (
                <DataInsightCard
                    key={dataInsight.id}
                    dataInsight={dataInsight}
                />
            ))}
        </Flex>
    )
}

function DataInsightCard({
    dataInsight,
}: {
    dataInsight: RequiredBy<OwidGdocDataInsightIndexItem, "image">
}) {
    const preview = (
        <img
            className="border"
            src={makePreviewImageSrc(dataInsight)}
            style={{ width: 265, height: 265 }}
        />
    )

    return (
        <Card cover={preview}>
            <a
                href={makePreviewLink(dataInsight)}
                target="_blank"
                rel="noreferrer noopener"
            >
                Preview
            </a>
            {" / "}
            <a
                href={makeGDocEditLink(dataInsight)}
                target="_blank"
                rel="noreferrer noopener"
            >
                GDoc
            </a>
            {dataInsight.figmaUrl && (
                <>
                    {" / "}
                    <a
                        href={dataInsight.figmaUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                    >
                        Figma
                    </a>
                </>
            )}
        </Card>
    )
}

function UploadImageModalContent({
    dataInsight,
}: {
    dataInsight: NarrativeDataInsightIndexItem
}) {
    const narrativeChartUrl = makeChartPngUrlForNarrativeChart(dataInsight)
    return (
        <div className="di-modal-content">
            <div>
                <b>Data insight</b>
                <br />
                {dataInsight.title}
            </div>

            <div>
                <b>Narrative chart</b>
                <br />
                {dataInsight.narrativeChart.name}
            </div>

            <div>
                <b>Filename</b>
                <br />
                {dataInsight.image.filename}
            </div>

            <div>
                <b>Preview (before/after)</b>
                <div className="preview">
                    <Space size="middle">
                        <img
                            className="border"
                            src={makePreviewImageSrc(dataInsight)}
                            width="350"
                            height="350"
                        />
                        <img
                            className="border"
                            src={narrativeChartUrl}
                            width="350"
                            height="350"
                        />
                    </Space>
                </div>
            </div>
        </div>
    )
}

async function uploadChartViewImage(
    admin: Admin,
    dataInsight: NarrativeDataInsightIndexItem
): Promise<UploadResponse> {
    const pngUrl = makeChartPngUrlForNarrativeChart(dataInsight)
    const imageResponse = await fetch(pngUrl)
    const blob = await imageResponse.blob()

    const payload = await fileToBase64(blob)
    if (!payload) {
        return {
            success: false,
            errorMessage: "Failed to convert image to base64",
        }
    }
    payload.filename = dataInsight.image.filename

    const response = await admin.requestJSON<UploadResponse>(
        `/api/images/${dataInsight.image.id}`,
        payload,
        "PUT"
    )

    return response
}

function hasNarrativeChart(
    dataInsight: OwidGdocDataInsightIndexItem
): dataInsight is RequiredBy<OwidGdocDataInsightIndexItem, "narrativeChart"> {
    return dataInsight.narrativeChart !== undefined
}

function hasImage(
    dataInsight: OwidGdocDataInsightIndexItem
): dataInsight is RequiredBy<OwidGdocDataInsightIndexItem, "image"> {
    return dataInsight.image !== undefined
}

function canReuploadImage(
    dataInsight: OwidGdocDataInsightIndexItem
): dataInsight is NarrativeDataInsightIndexItem {
    return hasImage(dataInsight) && hasNarrativeChart(dataInsight)
}

function makePreviewLink(dataInsight: OwidGdocDataInsightIndexItem) {
    return `/admin/gdocs/${dataInsight.id}/preview`
}

function makeGDocEditLink(dataInsight: OwidGdocDataInsightIndexItem) {
    return `https://docs.google.com/document/d/${dataInsight.id}/edit`
}

function makeNarrativeChartEditLink(
    dataInsight: RequiredBy<OwidGdocDataInsightIndexItem, "narrativeChart">
) {
    return `/admin/chartViews/${dataInsight.narrativeChart.id}/edit`
}

function makePreviewImageSrc(
    dataInsight: RequiredBy<OwidGdocDataInsightIndexItem, "image">
) {
    const { cloudflareId, originalWidth } = dataInsight.image
    return `${CLOUDFLARE_IMAGES_URL}/${cloudflareId}/w=${originalWidth}`
}

function makeChartPngUrlForNarrativeChart(
    dataInsight: RequiredBy<OwidGdocDataInsightIndexItem, "narrativeChart">
) {
    return `${makeGrapherDynamicThumbnailUrl()}/by-uuid/${dataInsight.narrativeChart.chartConfigId}.png?imType=square`
}

function makeGrapherDynamicThumbnailUrl() {
    if (ENV === "development") return "https://ourworldindata.org/grapher"
    return GRAPHER_DYNAMIC_THUMBNAIL_URL
}
