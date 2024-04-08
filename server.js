import express from 'express';
import compression from 'compression'; // Importez le module compression
import { render } from 'svelte-email';
import ContactEmail from '$lib/emails/ContactEmail.svelte';
import nodemailer from 'nodemailer';

const app = express();

// Utilisez le middleware compression
app.use(compression());

// Définissez vos routes après avoir configuré le middleware compression
app.post('/contact', async (req, res) => {
  const { name, lastname, email, phoneNumber, subject, message } = req.body;

  const emailHtml = render({
    component: ContactEmail,
    props: {
      name,
      lastname,
      email,
      phoneNumber,
      subject,
      message
    }
  });

  const transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: 'my_user',
      pass: 'my_password'
    }
  });

  const options = {
    from: 'you@example.com',
    to: 'user@gmail.com', // Remplacez par votre adresse e-mail de destination
    subject: 'Nouvelle soumission de formulaire de contact',
    html: emailHtml
  };

  try {
    const result = await transporter.sendMail(options);
    console.log('Email envoyé :', result);
    res.status(200).json({ message: 'Email envoyé avec succès' });
  } catch (error) {
    console.error('Erreur lors de l\'envoi de l\'e-mail :', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

app.listen(3000, () => {
  console.log('Serveur démarré sur le port 3000');
});
