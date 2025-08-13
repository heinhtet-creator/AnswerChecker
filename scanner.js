// scanner.js

// These functions are only used inside this file, so we don't need to export them.
function getSortedCorners(corners){
    let cornerArray=[];for(let i=0;i<4;i++)cornerArray.push({x:corners.data32S[i*2],y:corners.data32S[i*2+1]});cornerArray.sort((a,b)=>(a.x+a.y)-(b.x+b.y));let tl=cornerArray[0],br=cornerArray[3];cornerArray.sort((a,b)=>(a.y-a.x)-(b.y-b.x));let tr=cornerArray[0],bl=cornerArray[3];return cv.matFromArray(4,1,cv.CV_32FC2,[tl.x,tl.y,tr.x,tr.y,br.x,br.y,bl.x,bl.y])
}

function gradeBlock(imageBlock, warpedImageToDrawOn, blockOffsetX, blockOffsetY, questionsInBlock, choicesInBlock, numberColRatio, fillThreshold, confidenceThreshold, rowHeightRatio, strayMarkThreshold) {
    let answers = [];
    let gray = new cv.Mat();
    cv.cvtColor(imageBlock, gray, cv.COLOR_RGBA2GRAY);
    let thresh = new cv.Mat();
    cv.threshold(gray, thresh, 0, 255, cv.THRESH_BINARY_INV | cv.THRESH_OTSU);
    const questionRowHeight = thresh.rows / questionsInBlock;
    for (let i = 0; i < questionsInBlock; i++) {
        const y = i * questionRowHeight;
        let innerPixelsPerBubble = [];
        let isScribbled = false;
        const numberAreaWidth = imageBlock.cols * numberColRatio;
        const bubblesAreaWidth = imageBlock.cols - numberAreaWidth;
        const bubbleColWidth = bubblesAreaWidth / choicesInBlock;
        const roiActualHeight = questionRowHeight * (rowHeightRatio / 100);
        const yOffset = (questionRowHeight - roiActualHeight) / 2;
        for (let j = 0; j < choicesInBlock; j++) {
            const x = numberAreaWidth + (j * bubbleColWidth);
            const bubbleRect = new cv.Rect(x, y + yOffset, bubbleColWidth, roiActualHeight);
            const guardSize = Math.floor(Math.min(bubbleColWidth, roiActualHeight) * 0.25);
            const innerRect = new cv.Rect(
                bubbleRect.x + guardSize,
                bubbleRect.y + guardSize,
                bubbleRect.width - (guardSize * 2),
                bubbleRect.height - (guardSize * 2)
            );
            if (innerRect.width <= 0 || innerRect.height <= 0) {
                innerPixelsPerBubble.push(0);
                continue;
            }
            const bubbleRoi = thresh.roi(bubbleRect);
            const innerRoi = thresh.roi(innerRect);
            const totalFilledPixels = cv.countNonZero(bubbleRoi);
            const innerFilledPixels = cv.countNonZero(innerRoi);
            const outerFilledPixels = totalFilledPixels - innerFilledPixels;
            const outerArea = (bubbleRect.width * bubbleRect.height) - (innerRect.width * innerRect.height);
            const outerDensity = outerArea > 0 ? (outerFilledPixels / outerArea) : 0;
            innerPixelsPerBubble.push(innerFilledPixels);
            if (outerDensity > strayMarkThreshold) {
                isScribbled = true;
                bubbleRoi.delete();
                innerRoi.delete();
                break;
            }
            bubbleRoi.delete();
            innerRoi.delete();
        }
        let chosenAnswer;
        if (isScribbled) {
            chosenAnswer = -3;
        } else {
            const innerArea = (bubbleColWidth - Math.floor(bubbleColWidth * 0.25) * 2) * (roiActualHeight - Math.floor(roiActualHeight * 0.25) * 2);
            const maxPixels = Math.max(...innerPixelsPerBubble);
            if (maxPixels < innerArea * (fillThreshold / 100)) {
                chosenAnswer = -1;
            } else {
                const sortedPixels = [...innerPixelsPerBubble].sort((a, b) => b - a);
                const firstHighest = sortedPixels[0];
                const secondHighest = sortedPixels[1];
                if (firstHighest > secondHighest * confidenceThreshold) {
                    chosenAnswer = innerPixelsPerBubble.indexOf(firstHighest);
                } else {
                    chosenAnswer = -2;
                }
            }
        }
        answers.push(chosenAnswer);
    }
    gray.delete();
    thresh.delete();
    return answers;
}

// We only need to export the main function
export function fullProcessImage(allSelectors, answerKey) {
    try {
        const totalQuestions = parseInt(allSelectors.totalQuestionsInput.value);
        const answersPerQuestion = parseInt(allSelectors.answersPerQuestionInput.value);
        const pointsPerQuestion = parseFloat(allSelectors.pointsPerQuestionInput.value);
        const fillThreshold = parseFloat(allSelectors.fillThresholdSlider.value);
        const confidenceThreshold = parseFloat(allSelectors.confidenceThresholdSlider.value);
        const rowHeightRatio = parseFloat(allSelectors.rowHeightRatioSlider.value);
        const strayMarkThreshold = parseFloat(allSelectors.strayMarkThresholdSlider.value);
        const headerRatio = parseFloat(allSelectors.headerRatioSlider.value) / 100;
        const numberColRatio = parseFloat(allSelectors.numberColRatioSlider.value) / 100;
        let src = cv.imread(allSelectors.canvasElement);
        let processed = new cv.Mat();
        cv.cvtColor(src, processed, cv.COLOR_RGBA2GRAY);
        cv.GaussianBlur(processed, processed, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
        cv.adaptiveThreshold(processed, processed, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 11, 2);
        let contours = new cv.MatVector();
        let hierarchy = new cv.Mat();
        cv.findContours(processed, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
        let maxArea = 0, biggestContour = null;
        const minContourArea = src.cols * src.rows * 0.1;
        for (let i = 0; i < contours.size(); ++i) {
            let cnt = contours.get(i);
            let area = cv.contourArea(cnt);
            if (area > minContourArea) {
                let peri = cv.arcLength(cnt, true);
                let approx = new cv.Mat();
                cv.approxPolyDP(cnt, approx, 0.02 * peri, true);
                if (approx.rows === 4 && area > maxArea) {
                    maxArea = area;
                    biggestContour = approx.clone();
                }
                approx.delete();
            }
            cnt.delete();
        }
        if (biggestContour) {
            const paperWidth = 420 * 2, paperHeight = 594 * 2;
            let sortedCorners = getSortedCorners(biggestContour);
            let dsize = new cv.Size(paperWidth, paperHeight);
            let M = cv.getPerspectiveTransform(sortedCorners, cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, paperWidth, 0, paperWidth, paperHeight, 0, paperHeight]));
            let warped = new cv.Mat();
            cv.warpPerspective(src, warped, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());
            const midX = warped.cols / 2;
            const questionsPerBlock = totalQuestions / 2;
            let leftHalf = warped.roi(new cv.Rect(0, 0, midX, warped.rows));
            const leftHeaderHeight = Math.floor(leftHalf.rows * headerRatio);
            let leftHalfCropped = leftHalf.roi(new cv.Rect(0, leftHeaderHeight, leftHalf.cols, leftHalf.rows - leftHeaderHeight));
            let rightHalf = warped.roi(new cv.Rect(midX, 0, midX, warped.rows));
            const rightHeaderHeight = Math.floor(rightHalf.rows * headerRatio);
            let rightHalfCropped = rightHalf.roi(new cv.Rect(0, rightHeaderHeight, rightHalf.cols, rightHalf.rows - rightHeaderHeight));
            let leftAnswers = gradeBlock(leftHalfCropped, warped, 0, leftHeaderHeight, questionsPerBlock, answersPerQuestion, numberColRatio, fillThreshold, confidenceThreshold, rowHeightRatio, strayMarkThreshold);
            let rightAnswers = gradeBlock(rightHalfCropped, warped, midX, rightHeaderHeight, questionsPerBlock, answersPerQuestion, numberColRatio, fillThreshold, confidenceThreshold, rowHeightRatio, strayMarkThreshold);
            let finalUserAnswers = [...leftAnswers, ...rightAnswers];
            let score = 0;
            const warpedHeight = warped.rows;
            const blockHeight = warpedHeight * (1 - headerRatio);
            const questionRowHeight = blockHeight / questionsPerBlock;
            const blockWidth = midX;
            const numberAreaWidth = blockWidth * numberColRatio;
            const bubblesAreaWidth = blockWidth - numberAreaWidth;
            const bubbleColWidth = bubblesAreaWidth / answersPerQuestion;
            const COLOR_GREEN = new cv.Scalar(0, 255, 0, 255);
            const COLOR_RED = new cv.Scalar(255, 0, 0, 255);
            const COLOR_BLUE = new cv.Scalar(0, 0, 255, 255);
            const COLOR_YELLOW = new cv.Scalar(255, 255, 0, 255);
            const COLOR_PURPLE = new cv.Scalar(128, 0, 128, 255);
            for (let i = 0; i < totalQuestions; i++) {
                const userAnswer = finalUserAnswers[i];
                const correctAnswer = answerKey[i];
                if (userAnswer === correctAnswer) { score += pointsPerQuestion; }
                const blockIndex = Math.floor(i / questionsPerBlock);
                const questionIndexInBlock = i % questionsPerBlock;
                const blockOffsetX = blockIndex * midX;
                const headerHeight = warpedHeight * headerRatio;
                const questionY = headerHeight + (questionIndexInBlock * questionRowHeight);
                const circleRadius = Math.min(bubbleColWidth, questionRowHeight) / 3;
                if (userAnswer === correctAnswer) {
                    const bubbleX = blockOffsetX + numberAreaWidth + (correctAnswer * bubbleColWidth);
                    let center = new cv.Point(bubbleX + bubbleColWidth / 2, questionY + questionRowHeight / 2);
                    cv.circle(warped, center, circleRadius, COLOR_GREEN, 3);
                } else {
                    const correctBubbleX = blockOffsetX + numberAreaWidth + (correctAnswer * bubbleColWidth);
                    let correctCenter = new cv.Point(correctBubbleX + bubbleColWidth / 2, questionY + questionRowHeight / 2);
                    cv.circle(warped, correctCenter, circleRadius, COLOR_BLUE, 3);
                    if (userAnswer > -1) {
                        const userBubbleX = blockOffsetX + numberAreaWidth + (userAnswer * bubbleColWidth);
                        let userCenter = new cv.Point(userBubbleX + bubbleColWidth / 2, questionY + questionRowHeight / 2);
                        cv.circle(warped, userCenter, circleRadius, COLOR_RED, 3);
                    } else {
                        let highlightCenter = new cv.Point(blockOffsetX + numberAreaWidth / 2, questionY + questionRowHeight / 2);
                        if (userAnswer === -2) {
                            cv.circle(warped, highlightCenter, circleRadius, COLOR_YELLOW, 3);
                        } else if (userAnswer === -3) {
                            cv.circle(warped, highlightCenter, circleRadius * 1.2, COLOR_PURPLE, 3);
                        }
                    }
                }
            }
            const totalPossibleScore = totalQuestions * pointsPerQuestion;
            allSelectors.statusElement.textContent = `ရမှတ်: ${score} / ${totalPossibleScore}`;
            cv.imshow(allSelectors.canvasElement, warped);
            allSelectors.saveResultContainer.style.display = 'block';
            allSelectors.scanActionsContainer.style.display = 'none';
            allSelectors.openTuningModalButton.style.display = 'block';
            leftHalf.delete(); rightHalf.delete(); leftHalfCropped.delete(); rightHalfCropped.delete();
            warped.delete(); M.delete(); sortedCorners.delete();
            // Return the result object
            return { score, total: totalPossibleScore };
        } else {
            allSelectors.statusElement.textContent = "အဖြေလွှာကို ရှာမတွေ့ပါ။";
            cv.imshow(allSelectors.canvasElement, src);
        }
        src.delete(); processed.delete(); contours.delete(); hierarchy.delete();
        if (biggestContour) biggestContour.delete();
    } catch (err) {
        console.error("OpenCV error: ", err);
        allSelectors.statusElement.textContent = "စစ်ဆေးရာတွင် အမှားအယွင်း ဖြစ်ပေါ်နေပါသည်။";
    }
    // Return null or an empty object on failure
    return null;
}


