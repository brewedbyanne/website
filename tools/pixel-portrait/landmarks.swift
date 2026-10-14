// Usage: swift landmarks.swift <photo.jpg> <landmarks.json>
// Uses macOS's built-in face detection (Vision) to write the positions of facial features
// (eyes, pupils, eyebrows, lips, nose) as photo pixel coordinates, origin at the top left.
import CoreImage
import Foundation
import Vision

let args = CommandLine.arguments
let input = URL(fileURLWithPath: args[1])
let output = URL(fileURLWithPath: args[2])

guard let photo = CIImage(contentsOf: input, options: [.applyOrientationProperty: true]) else {
    fatalError("Couldn't read \(input.path)")
}
let width = photo.extent.width
let height = photo.extent.height

let request = VNDetectFaceLandmarksRequest()
try VNImageRequestHandler(ciImage: photo, options: [:]).perform([request])
guard let face = request.results?.first, let landmarks = face.landmarks else {
    fatalError("No face found in \(input.path)")
}

// Vision gives points relative to the face box, with the origin at the bottom left
func points(_ region: VNFaceLandmarkRegion2D?) -> [[Double]] {
    guard let region = region else { return [] }
    let box = face.boundingBox
    return region.normalizedPoints.map { p in
        let x = (box.origin.x + CGFloat(p.x) * box.width) * width
        let y = (1 - (box.origin.y + CGFloat(p.y) * box.height)) * height
        return [Double(x), Double(y)]
    }
}

let result: [String: [[Double]]] = [
    "leftEye": points(landmarks.leftEye),
    "rightEye": points(landmarks.rightEye),
    "leftPupil": points(landmarks.leftPupil),
    "rightPupil": points(landmarks.rightPupil),
    "leftEyebrow": points(landmarks.leftEyebrow),
    "rightEyebrow": points(landmarks.rightEyebrow),
    "outerLips": points(landmarks.outerLips),
    "innerLips": points(landmarks.innerLips),
    "nose": points(landmarks.nose),
    "faceContour": points(landmarks.faceContour),
]
try JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted]).write(to: output)
print("wrote \(output.path)")
