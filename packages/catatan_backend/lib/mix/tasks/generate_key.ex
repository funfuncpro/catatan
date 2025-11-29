defmodule Mix.Tasks.Catatan.GenerateKey do
  @moduledoc """
  Generates a new AES-256 encryption key for use with CatatanBackend.

  The key is output as a base64-encoded string suitable for use in
  environment variables.

  ## Usage

      mix catatan.generate_key

  ## Example Output

      Generated new encryption key (keep this secret!):
      ENCRYPTION_KEY=dGhpc2lzYXNlY3JldGtleWZvcmFlczI1Ng==

      Add this to your .env file:
      echo 'ENCRYPTION_KEY=dGhpc2lzYXNlY3JldGtleWZvcmFlczI1Ng==' >> .env

  ## Security Notes

  - Keep this key secret and secure
  - Use different keys for development, staging, and production
  - Back up your encryption keys in a secure location
  - Never commit keys to version control
  - If the key is lost, encrypted data cannot be recovered
  """

  use Mix.Task

  @shortdoc "Generates a new encryption key for notes"

  @impl Mix.Task
  def run(_args) do
    key = CatatanBackend.Encryption.generate_key()

    Mix.shell().info("\n" <> IO.ANSI.green() <> "✓ Generated new encryption key (keep this secret!)" <> IO.ANSI.reset())
    Mix.shell().info("\n" <> IO.ANSI.yellow() <> "ENCRYPTION_KEY=#{key}" <> IO.ANSI.reset())

    Mix.shell().info("\n" <> IO.ANSI.cyan() <> "Add this to your .env file:" <> IO.ANSI.reset())
    Mix.shell().info("echo 'ENCRYPTION_KEY=#{key}' >> .env")

    Mix.shell().info("\n" <> IO.ANSI.red() <> "⚠️  Security Notes:" <> IO.ANSI.reset())
    Mix.shell().info("  • Keep this key secret and secure")
    Mix.shell().info("  • Use different keys for dev, staging, and production")
    Mix.shell().info("  • Back up your keys in a secure location")
    Mix.shell().info("  • Never commit keys to version control")
    Mix.shell().info("  • If lost, encrypted data cannot be recovered")
    Mix.shell().info("")
  end
end
