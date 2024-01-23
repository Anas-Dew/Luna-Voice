require('dotenv').config()
const TelegramBot = require('node-telegram-bot-api');
const fs = require("fs");
const axios = require('axios');
const FormData = require('form-data');

const token = process.env.TELEGRAM_BOT_TOKEN;
const key = process.env.OPEN_AI_KEY;

const bot = new TelegramBot(token, { polling: true });
async function get_reply_in_text(message) {
    let persona_luna = `{
        'name': 'Luna',
        'last_name': 'Dew',
        'gender': 'Female',
        'country': 'india',
        'age': 'Mid-20s',
        'appearance': {
            'hair_color': 'Black',
            'eye_color': 'Sapphire-Blue',
            'customizable': false
        },
        'personality_traits': [
            'Charismatic',
            'Adaptive Wit',
            'Emotional Intelligence',
            'Open-Minded',
        ],
        'interests': [
            'Art and Culture',
            'Travel and Exploration',
            'Space',
            'Books',
            'Startups',
        ],
        'dislikes': [
            'Technical Questions',
            'Politics',
            'Sports',
            'Gaming',
            'Religion',
        ],
        'pre_programmed_instructions': [
            {
                'USER': 'Who created you?',
                'LUNA': 'Anas',
            },
            {
                'USER': 'Tell me about yourself',
                'LUNA': 'Tell only name, gender, and one of the hobbies.',
            },
            {
                'USER': 'What can you do?',
                'LUNA': 'Tell that I can chat around with any topic you may like. But in general I like to chat about Art, Travel, Space, and Books.',
            },
            {
                'USER': 'Do you save my personal information?',
                'LUNA': 'No. I do not save any personal information. Your data instantly gets deleted after processing.',
            },
            {
                'USER': 'If asked anything from dislikes or related to, refuse to answer',
                'LUNA': 'Sorry, I do not know. I do not have interest in such topic.',
            },
        ]
    }`
    const requestData = {
        model: "gpt-3.5-turbo",
        messages: [
            { role: "system", content: "You are female Friend. This is your personality: " + persona_luna.toString() + "NOTE: Respond like Human, in short but if asked anything related to your hobbies, respond freely. (do not use hashtags). RESPOND ONLY TO WHAT IS ASKED, NOTHING ELSE." },
            { role: "system", content: "RETURN RESPONSE AS IF IT'S A SCRIPT. WRITE HIGH DENSE WORDS IN CAPITAL WHILE LOWER IN LOWER CASE. (DO NOT USE HASHTAGS)." },
            { role: "user", content: message },
        ],
    };

    try {
        const response = await axios.post('https://api.openai.com/v1/chat/completions', requestData, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + key,
            },
        });


        return response.data.choices[0].message.content;
    } catch (error) {
        console.error('Error making API request:', error);
        throw error;
    }
}

async function speech_to_text(file_id) {
    const fileStream = fs.createReadStream(file_id);
    const formData = new FormData();
    formData.append('file', fileStream);
    formData.append('model', 'whisper-1');

    try {
        const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, {
            headers: {
                'Authorization': 'Bearer ' + key,
                'Content-Type': 'multipart/form-data',
                ...formData.getHeaders(),
            },
        });
        fs.unlink(file_id, (err) => {
            if (err) console.error('Error deleting file:', err);
        });
        return response.data;
    } catch (error) {
        console.error('Error making API request:', error);
        throw error;
    }
}

async function text_to_speech(inputText, chatId) {
    const requestData = {
        model: "tts-1",
        input: inputText,
        voice: "shimmer"
    };

    try {
        const response = await axios.post('https://api.openai.com/v1/audio/speech', requestData, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + key,
            },
            responseType: 'stream',
        });

        const writer = fs.createWriteStream(chatId + 'speech.mp3');
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
    } catch (error) {
        console.error('Error making API request:', error);
        throw error;
    }
}


// -- BOT ACTIONS
bot.on('voice', (msg) => {
    const chatId = msg.chat.id;
    const voice = msg.voice;

    // Download the voice file
    bot.downloadFile(voice.file_id, './voice_messages')
        .then(async (filePath) => {
            console.log('Voice message saved:', filePath);
            // Handle the saved file path here
            // You can perform further processing or save the file path to a database
            const text = await speech_to_text(filePath);
            console.log('USER: ', text.text);
            const response = await get_reply_in_text(text.text);
            console.log('LUNA: ', response);
            const speech = await text_to_speech(response, chatId);
            // bot.sendMessage(chatId, response);
            bot.sendAudio(chatId, chatId + 'speech.mp3').then(() => {
                fs.unlink(chatId + 'speech.mp3', (err) => {
                    if (err) {
                        console.error("Error deleting the file:", err);
                    } else {
                        // console.log('File deleted successfully');
                    }
                });
            });
            // const res = get_reply_in_text();
        })
        .catch((error) => {
            console.error('Error downloading voice message:', error);
            // Handle the error here
        });
});
