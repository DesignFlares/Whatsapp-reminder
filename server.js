require('dotenv').config();

const express = require('express');

const cron = require('node-cron');

const mongoose = require('mongoose');

const QRCode = require('qrcode');

const { Client, LocalAuth } = require('whatsapp-web.js');

const app = express();

const PORT = process.env.PORT || 3000;

/*
-----------------------------------
MIDDLEWARE
-----------------------------------
*/

app.use(express.json());

app.use(express.urlencoded({
    extended: true
}));

/*
-----------------------------------
EJS
-----------------------------------
*/

app.set('view engine', 'ejs');

/*
-----------------------------------
MONGODB CONNECTION
-----------------------------------
*/

mongoose.connect(process.env.MONGO_URI)
.then(() => {

    console.log('\nMongoDB Connected\n');

})
.catch((error) => {

    console.log(error);

});

/*
-----------------------------------
REMINDER SCHEMA
-----------------------------------
*/

const reminderSchema = new mongoose.Schema({

    number: {
        type: String,
        required: true
    },

    message: {
        type: String,
        required: true
    }

});

const Reminder = mongoose.model(
    'Reminder',
    reminderSchema
);

/*
-----------------------------------
GLOBAL VARIABLES
-----------------------------------
*/

let isRunning = false;

let qrImage = '';

/*
-----------------------------------
WHATSAPP CLIENT
-----------------------------------
*/

const client = new Client({

    authStrategy: new LocalAuth({
        clientId: 'main-client'
    }),

    puppeteer: {

        headless: false,

        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage'
        ]
    }
});

/*
-----------------------------------
QR EVENT
-----------------------------------
*/

client.on('qr', async (qr) => {

    console.log('\nQR Generated\n');

    qrImage = await QRCode.toDataURL(qr);

});

/*
-----------------------------------
AUTHENTICATED EVENT
-----------------------------------
*/

client.on('authenticated', () => {

    console.log('\nAuthenticated Successfully\n');

});

/*
-----------------------------------
READY EVENT
-----------------------------------
*/

client.on('ready', () => {

    console.log('\nWhatsApp is Ready!\n');

    /*
    REMOVE QR AFTER LOGIN
    */

    qrImage = '';

});

/*
-----------------------------------
DISCONNECTED EVENT
-----------------------------------
*/

client.on('disconnected', (reason) => {

    console.log('\nWhatsApp Disconnected\n');

    console.log(reason);

});

/*
-----------------------------------
INITIALIZE CLIENT
-----------------------------------
*/

setTimeout(() => {

    client.initialize();

}, 3000);

/*
-----------------------------------
CRON JOB
Every 1 Minute For Testing
-----------------------------------
*/

cron.schedule('*/1 * * * *', async () => {

    console.log('\nCron Triggered');

    console.log(new Date());

    if (!isRunning) {

        console.log('Reminder System Stopped');

        return;
    }

    try {

        const reminders = await Reminder.find();

        for (const reminder of reminders) {

            await client.sendMessage(
                reminder.number,
                reminder.message
            );

            console.log(
                `Message Sent To ${reminder.number}`
            );

            /*
            SMALL DELAY
            */

            await new Promise(resolve =>
                setTimeout(resolve, 3000)
            );

        }

    }
    catch (error) {

        console.log('\nError Sending Messages\n');

        console.log(error);

    }

});

/*
-----------------------------------
HOME ROUTE
-----------------------------------
*/

app.get('/', async (req, res) => {

    try {

        const reminders = await Reminder.find();

        res.render('index', {

            reminders,
            isRunning,
            qrImage

        });

    }
    catch (error) {

        console.log(error);

    }

});

/*
-----------------------------------
ADD REMINDER
-----------------------------------
*/

app.post('/add', async (req, res) => {

    try {

        const { number, message } = req.body;

        await Reminder.create({

            number,
            message

        });

        res.redirect('/');

    }
    catch (error) {

        console.log(error);

    }

});

/*
-----------------------------------
DELETE REMINDER
-----------------------------------
*/

app.get('/delete/:number', async (req, res) => {

    try {

        await Reminder.findOneAndDelete({

            number: req.params.number

        });

        res.redirect('/');

    }
    catch (error) {

        console.log(error);

    }

});

/*
-----------------------------------
START REMINDER SYSTEM
-----------------------------------
*/

app.get('/start', (req, res) => {

    isRunning = true;

    console.log('\nReminder System Started\n');

    res.redirect('/');

});

/*
-----------------------------------
STOP REMINDER SYSTEM
-----------------------------------
*/

app.get('/stop', (req, res) => {

    isRunning = false;

    console.log('\nReminder System Stopped\n');

    res.redirect('/');

});

/*
-----------------------------------
PING ROUTE
-----------------------------------
*/

app.get('/ping', (req, res) => {

    res.send('Server Awake');

});

/*
-----------------------------------
SERVER
-----------------------------------
*/

app.listen(PORT, () => {

    console.log(`\nServer Running On Port ${PORT}\n`);

});

/*
-----------------------------------
GRACEFUL SHUTDOWN
-----------------------------------
*/

process.on('SIGINT', async () => {

    console.log('\nClosing WhatsApp Client...\n');

    await client.destroy();

    process.exit();

});