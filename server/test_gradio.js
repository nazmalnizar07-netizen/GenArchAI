const { Client } = require('@gradio/client');
const fs = require('fs');
require('dotenv').config();

async function run() {
    try {
        console.log('Connecting to Gradio space...');
        // Let's connect to an official HF or popular space for sketch-to-image
        // Trying: xinsir/controlnet-union-sdxl-1.0
        const app = await Client.connect("xinsir/controlnet-union-sdxl-1.0");

        console.log('Connected! Generating image...');

        // Grab one of the saved images from uploads
        const files = fs.readdirSync('./uploads');
        if (files.length === 0) {
            console.log('No uploaded sketches found to test with.');
            return;
        }

        const testImage = fs.readFileSync(`./uploads/${files[0]}`);
        const blob = new Blob([testImage], { type: 'image/png' });

        // Submit the prediction
        const result = await app.predict(0, [
            blob, // blob in 'Control Image' Image component		
            "a modern house", // string  in 'Prompt' Textbox component		
            0, // number (numeric value between 0 and 5) in 'control_type' Slider component. 0 = canny/mlsd/sketch/depth/normal/softedge
            "best quality, extreme detail", // string  in 'Negative Prompt' Textbox component		
            50, // number (numeric value between 1 and 100) in 'Sampling Steps' Slider component		
            42, // number (numeric value between 0 and 2147483647) in 'Seed' Slider component		
            1.5, // number (numeric value between 0.1 and 2.0) in 'Controlnet Weight' Slider component		
            true, // boolean  in 'Crop' Checkbox component		
        ]);

        console.log('[SUCCESS]', result);
    } catch (err) {
        console.error('[ERROR]', err.message);
    }
}

run();
