import { NextRequest } from 'next/server'
import { PDFDocument } from 'pdf-lib'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf'
import { withAuth } from '@/lib/handlers'
import { successResponse } from '@/lib/response'
import { loadPdf } from '@/lib/pdf-loader'

// Configure pdfjs-dist for serverless environment
pdfjsLib.GlobalWorkerOptions.workerSrc = ''

export const POST = withAuth(async (request: NextRequest, context) => {
  const { buffer, params } = await loadPdf(request)

  // Parse and validate parameters
  const {
    min_width = 0,
    min_height = 0,
    format = 'png'
  } = params

  if (min_width < 0 || min_height < 0) {
    throw new Error('INVALID_PARAMS')
  }

  if (!['png', 'jpeg'].includes(format)) {
    throw new Error('INVALID_PARAMS')
  }

  // Get basic PDF info
  const pdfDoc = await PDFDocument.load(buffer)
  const totalPages = pdfDoc.getPageCount()

  const extractedImages = []
  let totalImagesFound = 0

  try {
    // Load PDF with pdfjs-dist for image extraction
    const loadingTask = pdfjsLib.getDocument({
      data: buffer,
      disableWorker: true,
    })

    const pdfDocument = await loadingTask.promise

    // Process each page
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      try {
        const page = await pdfDocument.getPage(pageNum)
        const operatorList = await page.getOperatorList()

        // Find image operations
        for (let i = 0; i < operatorList.fnArray.length; i++) {
          const fn = operatorList.fnArray[i]

          // Check if this is an image painting operation
          if (fn === pdfjsLib.OPS.paintImageXObject) {
            const imgName = operatorList.argsArray[i][0]

            try {
              // Get image object
              const pageObjects = await page.objs.getObjs()

              for (const [key, obj] of Object.entries(pageObjects)) {
                if (key === imgName && obj && typeof obj === 'object') {
                  const imageObj = obj as any

                  // Extract image data if available
                  if (imageObj.bitmap || imageObj.data) {
                    const imgData = imageObj.bitmap || imageObj.data
                    const width = imageObj.width || imgData.width || 0
                    const height = imageObj.height || imgData.height || 0

                    totalImagesFound++

                    // Apply size filters
                    if (width >= min_width && height >= min_height) {
                      try {
                        let base64Data = ''

                        // Convert image data to base64
                        if (imageObj.bitmap && imageObj.bitmap instanceof ImageData) {
                          // Convert ImageData to canvas and extract as base64
                          const canvas = new OffscreenCanvas(width, height)
                          const ctx = canvas.getContext('2d')
                          if (ctx) {
                            ctx.putImageData(imageObj.bitmap, 0, 0)
                            const blob = await canvas.convertToBlob({ type: `image/${format}` })
                            const arrayBuffer = await blob.arrayBuffer()
                            base64Data = Buffer.from(arrayBuffer).toString('base64')
                          }
                        } else if (imageObj.data && imageObj.data instanceof Uint8Array) {
                          // Direct binary data
                          base64Data = Buffer.from(imageObj.data).toString('base64')
                        }

                        if (base64Data) {
                          extractedImages.push({
                            page: pageNum,
                            width: width,
                            height: height,
                            format: format,
                            data: base64Data,
                            size_bytes: base64Data.length * 0.75, // Approximate binary size
                            image_name: imgName
                          })
                        }

                      } catch (imageError) {
                        console.warn(`Failed to extract image ${imgName} from page ${pageNum}:`, imageError)
                      }
                    }
                  }
                }
              }

            } catch (objError) {
              console.warn(`Failed to get objects for image ${imgName} on page ${pageNum}:`, objError)
            }
          }
        }

      } catch (pageError) {
        console.warn(`Failed to process page ${pageNum}:`, pageError)
        continue
      }
    }

    await pdfDocument.destroy()

  } catch (error) {
    console.error('Image extraction failed:', error)

    // Return partial results if we found some images, otherwise fail
    if (extractedImages.length > 0) {
      return successResponse({
        images: extractedImages,
        total_images_extracted: extractedImages.length,
        total_images_found: totalImagesFound,
        total_pages: totalPages,
        filters_applied: {
          min_width: min_width,
          min_height: min_height,
          format: format
        },
        notes: ['Image extraction completed with some errors. Some images may be missing.'],
        extraction_method: 'pdfjs-dist'
      }, {
        request_id: context.requestId,
        remaining_credits: 999,
      })
    } else {
      throw new Error('PROCESSING_FAILED')
    }
  }

  const responseData = {
    images: extractedImages,
    total_images_extracted: extractedImages.length,
    total_images_found: totalImagesFound,
    total_pages: totalPages,
    filters_applied: {
      min_width: min_width,
      min_height: min_height,
      format: format
    },
    extraction_method: 'pdfjs-dist',
    notes: extractedImages.length === 0
      ? ['No images found that meet the size criteria.']
      : totalImagesFound > extractedImages.length
      ? [`Found ${totalImagesFound} images, ${extractedImages.length} met size criteria.`]
      : []
  }

  return successResponse(responseData, {
    request_id: context.requestId,
    remaining_credits: 999,
  })
})