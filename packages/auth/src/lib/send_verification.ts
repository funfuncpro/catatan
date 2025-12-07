export async function sendVerificationCode(
  email: string,
  code: string
): Promise<void> {
  const mailerApiURL = process.env.MAILER_API_URL;
  const mailerApiKey = process.env.MAILER_API_KEY;

  if (!mailerApiURL || !mailerApiKey) {
    throw new Error(
      "Mailer API URL or API Key is not defined in environment variables."
    );
  }

  const response = await fetch(mailerApiURL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${mailerApiKey}`,
    },
    body: JSON.stringify({
      email: email,
      verification_code: code,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to send verification code. Status: ${response.status}, Body: ${errorText}`
    );
  }
}
