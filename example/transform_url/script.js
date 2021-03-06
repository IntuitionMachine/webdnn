'use strict';

let runner = null;
let samples = null;
let table = null;

function showMessage(text) {
    document.getElementById('message').textContent = text;
}

async function onButtonClick() {
    try {
        await run();
        console.log('run finished');

    } catch (error) {
        showMessage('run failed: ' + error);
        console.error('run failed ' + error);
    }
}

function reset() {
    runner = null;
    resetResult();
}

async function initialize() {
    let backend = document.querySelector('input[name=backend]:checked').value;
    let framework = document.querySelector('input[name=framework]:checked').value;
    let transform_prefix = document.querySelector('input[name=transform-prefix]').value;
    // transformUrlDelegate: used to redirect webdnn-related http request to another url.
    // see the console for what transformation is performed.
    runner = await WebDNN.load('http://example.com/foo/', {
        backendOrder: backend,
        transformUrlDelegate: (url) => {
            let idx = url.lastIndexOf('/');
            if (idx >= 0) {
                let new_url = transform_prefix + url.substr(idx + 1); // prefix + basename
                console.log(`transformUrlDelegate: ${url} => ${new_url}`);
                url = new_url;
            } else {
                console.log(`transformUrlDelegate: ${url} not transformed`);
            }
            return url;
        }
    });
    showMessage(`Backend: ${runner.backendName}, model converted from ${framework}`);
    console.info(`Backend: ${runner.backendName}, model converted from ${framework}`);
    samples = await fetchSamples(`../mnist/output_${framework}/test_samples.json`);
    table = document.getElementById('result');
}

async function run() {
    if (!runner) await initialize();
    resetResult();

    let totalElapsedTime = 0;

    for (let i = 0; i < samples.length; i++) {
        let sample = samples[i];
        runner.inputs[0].set(sample.x);
        console.log(`ground truth: ${sample.y}`);

        let start = performance.now();
        await runner.run();
        totalElapsedTime += performance.now() - start;

        console.log(runner.outputs[0]);

        let predictedLabel = WebDNN.Math.argmax(runner.outputs[0])[0];
        console.log(`predicted: ${predictedLabel}`);

        displayPrediction(sample.x, predictedLabel, sample.y);
    }

    console.log(`Elapsed Time [ms/image]: ${(totalElapsedTime / samples.length).toFixed(2)}`);
}

async function fetchSamples(path) {
    let response = await fetch(path);
    if (!response.ok) throw new Error('Failed to load test samples');

    let json = await response.json();
    let samples = [];
    for (let i = 0; i < json.length; i++) {
        samples.push({ 'x': new Float32Array(json[i]['x']), 'y': json[i]['y'] });
    }

    return samples;
}

function resetResult() {
    if (!table) return;
    while (table.rows.length >= 2) table.deleteRow(-1);
}

function displayPrediction(inputImage, prediction, groundTruth) {
    let canvas = document.createElement('canvas');
    canvas.width = 28;
    canvas.height = 28;
    let ctx = canvas.getContext('2d');
    let img = ctx.createImageData(28, 28);
    for (let i = 0; i < 28 * 28; i++) {
        let pixel = inputImage[i] * 255;
        img.data[i * 4 + 0] = pixel;//r
        img.data[i * 4 + 1] = pixel;//g
        img.data[i * 4 + 2] = pixel;//b
        img.data[i * 4 + 3] = 255;//a
    }
    ctx.putImageData(img, 0, 0);

    let tr = table.insertRow();
    tr.appendChild(document.createElement('td')).appendChild(canvas);
    tr.appendChild(document.createElement('td')).textContent = '' + prediction;
    tr.appendChild(document.createElement('td')).textContent = '' + groundTruth;
}
