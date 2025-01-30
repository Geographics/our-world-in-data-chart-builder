import { faCheck, faSpinner } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { Modal, Space } from "antd"
import { useState } from "react"
import { CLOUDFLARE_IMAGES_URL } from "../settings/clientSettings"
import { Admin } from "./Admin"
import {
    ImageUploadResponse,
    reuploadImageFromSourceUrl,
} from "./imagesHelpers"

const spinnerIcon = <FontAwesomeIcon icon={faSpinner} spin />
const checkIcon = <FontAwesomeIcon icon={faCheck} />

export function ReuploadImageForDataInsightModal({
    admin,
    modalTitle = "Upload image for data insight",
    existingImage,
    sourceUrl,
    isLoadingSourceUrl,
    loadingSourceUrlError,
    content,
    closeModal,
    onUploadComplete,
    dataInsightId,
}: {
    admin: Admin
    dataInsightId: string
    modalTitle?: string
    existingImage: {
        id: number
        filename: string
        cloudflareId: string
        originalWidth: number
    }
    sourceUrl?: string
    isLoadingSourceUrl?: boolean
    loadingSourceUrlError?: string
    content?: { keyword: string; value: string }[]
    closeModal: () => void
    onUploadComplete?: (
        dataInsightId: string,
        response: ImageUploadResponse
    ) => void
}) {
    const [isImageUploadInProgress, setIsImageUploadInProgress] =
        useState(false)

    const handleImageUpload = async () => {
        setIsImageUploadInProgress(true)
        const response = sourceUrl
            ? await reuploadImageFromSourceUrl({
                  admin,
                  image: existingImage,
                  sourceUrl,
              })
            : ({
                  success: false,
                  errorMessage: "No source URL",
              } as ImageUploadResponse)
        onUploadComplete?.(dataInsightId, response)
        setIsImageUploadInProgress(false)
        closeModal()
    }

    return (
        <Modal
            title={modalTitle}
            open={true}
            width={765}
            okText="Upload"
            okButtonProps={{
                icon: isImageUploadInProgress ? spinnerIcon : checkIcon,
                disabled:
                    isImageUploadInProgress ||
                    isLoadingSourceUrl ||
                    (!sourceUrl && !isLoadingSourceUrl),
            }}
            onOk={() => handleImageUpload()}
            onCancel={() => closeModal()}
        >
            <div className="di-modal-content">
                {content?.map(({ keyword, value }) => (
                    <div key={keyword}>
                        <b>{keyword}</b>
                        <br />
                        {value}
                    </div>
                ))}

                <div>
                    <b>Filename</b>
                    <br />
                    {existingImage.filename}
                </div>

                <ImagePreview
                    imageBefore={`${CLOUDFLARE_IMAGES_URL}/${existingImage.cloudflareId}/w=${existingImage.originalWidth}`}
                    imageAfter={sourceUrl}
                    isLoading={isLoadingSourceUrl}
                    loadingError={loadingSourceUrlError}
                />
            </div>
        </Modal>
    )
}

function ImagePreview({
    imageBefore,
    imageAfter,
    size = 350,
    isLoading = false,
    loadingError = "",
}: {
    imageBefore: string
    imageAfter?: string
    size?: number
    isLoading?: boolean
    loadingError?: string
}) {
    return (
        <div>
            <b>Preview (before/after)</b>
            <div className="image-preview">
                <Space size="middle">
                    <img
                        className="border"
                        src={imageBefore}
                        width={size}
                        height={size}
                    />
                    {isLoading ? (
                        <div className="placeholder">{spinnerIcon}</div>
                    ) : imageAfter ? (
                        <img
                            className="border"
                            src={imageAfter}
                            width={size}
                            height={size}
                        />
                    ) : (
                        <div className="error">
                            <b>Loading preview failed</b>
                            <p>{loadingError}</p>
                        </div>
                    )}
                </Space>
            </div>
        </div>
    )
}
