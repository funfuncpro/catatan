import { issuer } from "@openauthjs/openauth/issuer";
import { PasswordProvider } from "@openauthjs/openauth/provider/password";
import { PasswordUI } from "@openauthjs/openauth/ui/password";
import { DynamoStorage } from "@openauthjs/openauth/storage/dynamo";
import { subjects } from "./subjects/subject";
import { sendVerificationCode } from "./lib/send_verification";

export default {
  fetch: issuer({
    theme: {
      title: "Catatan",
      logo: {
        dark: "https://catatan-assets.hkalipaksi.me/logo/dark.png",
        light: "https://catatan-assets.hkalipaksi.me/logo/light.png",
      },
      background: {
        dark: "black",
        light: "white",
      },

      primary: {
        dark: "white",
        light: "black",
      },
      font: {
        family: "IBM Plex Sans, sans-serif",
      },
      css: `
			@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,100..700;1,100..700&display=swap');
			[data-component="logo"] {
				margin: 0 auto;
				height: 5rem;
				width: auto;
				display: none;

				@media (prefers-color-scheme: light) {
					&[data-mode="light"] {
						display: block;
					}
				}

				@media (prefers-color-scheme: dark) {
					&[data-mode="dark"] {
						display: block;
					}
				}
			}
			`,
      favicon: "https://catatan-assets.hkalipaksi.me/logo/favicon.ico",
    },
    providers: {
      password: PasswordProvider(
        PasswordUI({
          copy: {
            error_email_taken: "This email is already registered.",
          },
          sendCode: async (email, code) => {
            await sendVerificationCode(email, code);
          },
          validatePassword: (password) => {
            if (password.length < 8) {
              return "Password must be at least 8 characters long.";
            }
          },
        })
      ),
    },
    subjects,
    storage: DynamoStorage({
      table: "catatan-auth",
      pk: "user",
      sk: "subject",
    }),
    async success(ctx, response) {
      if (response.provider === "password") {
        return ctx.subject("user", {
          external_id: "",
          email: response.email,
        });
      }
      throw new Error("Invalid providers");
    },
  }).fetch,
  port: Bun.env.PORT ? Number(Bun.env.PORT) : 8000,
};
