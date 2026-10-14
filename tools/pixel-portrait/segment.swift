// Usage: swift segment.swift <photo.jpg> <mask.png>
// Uses macOS's built-in person detection (Vision) to write a black-and-white mask the
// same size as the photo: white where a person is, black everywhere else.
import AppKit
import CoreImage
import Foundation
import Vision

let args = CommandLine.arguments
let input = URL(fileURLWithPath: args[1])
let output = URL(fileURLWithPath: args[2])

guard let photo = CIImage(contentsOf: input, options: [.applyOrientationProperty: true]) else {
    fatalError("Couldn't read \(input.path)")
}

let request = VNGeneratePersonSegmentationRequest()
request.qualityLevel = .accurate
request.outputPixelFormat = kCVPixelFormatType_OneComponent8

try VNImageRequestHandler(ciImage: photo, options: [:]).perform([request])
guard let maskBuffer = request.results?.first?.pixelBuffer else {
    fatalError("No person found in \(input.path)")
}

// Vision's mask is smaller than the photo; stretch it to match
var mask = CIImage(cvPixelBuffer: maskBuffer)
mask = mask.transformed(by: CGAffineTransform(
    scaleX: photo.extent.width / mask.extent.width,
    y: photo.extent.height / mask.extent.height))

try CIContext().writePNGRepresentation(
    of: mask, to: output, format: .L8, colorSpace: CGColorSpaceCreateDeviceGray())
print("wrote \(output.path) (\(Int(photo.extent.width))x\(Int(photo.extent.height)))")
