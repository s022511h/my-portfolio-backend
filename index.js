require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(compression());

app.post('/contact', async (req, res) => {
  const { name, email, message } = req.body;

  console.log('📨 Incoming contact request:', { name, email, message });

  if (!name || !email || !message) {
    console.warn('🚫 Missing fields:', { name, email, message });
    return res.status(400).json({ error: 'Missing form fields.' });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    await transporter.sendMail({
      from: `"N15 Labs Contact" <${process.env.EMAIL_USER}>`,
      to: process.env.TO_EMAIL,
      subject: `New Contact Form Submission from ${name}`,
      html: `
        <h3>You received a new message from your site</h3>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Message:</strong><br/>${message}</p>
      `
    });

    console.log('✅ Email sent successfully');
    res.status(200).send('Message sent successfully!');
  } catch (error) {
    console.error('❌ Error sending email:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
      response: error.response
    });

    res.status(500).json({
      error: 'Failed to send message',
      message: error.message,
      detail: error.response || 'No response from mail server'
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Backend API running at http://localhost:${PORT}`);
});
