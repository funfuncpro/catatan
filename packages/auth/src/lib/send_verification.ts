async function sendVerificationCode(email: string, code: string) {
  let mailerApiURL = process.env.MAILER_API_URL;
  let mailerApiKey = process.env.MAILER_API_KEY;

  if (!mailerApiURL || !mailerApiKey) {
    throw new Error(
      "Mailer API URL or API Key is not defined in environment variables."
    );
  }
  const response = await fetch(mailerApiURL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: email,
      verification_code: code,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to send verification code. Status: ${response.status}`
    );
  }
}
