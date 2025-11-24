import Config

# For development, load environment variables from .env file
env_filepath = Path.join(File.cwd!(), ".env")

case File.exists?(env_filepath) do
  true ->
    case File.read(env_filepath) do
      {:ok, content} ->
        content
        |> String.split("\n", trim: true)
        |> Enum.reject(&(String.starts_with?(&1, "#") or &1 == ""))
        |> Enum.each(fn line ->
          case String.split(line, "=", parts: 2) do
            [key, value] ->
              System.put_env(String.trim(key), String.trim(value))

            _ ->
              IO.warn("Invalid line in .env: #{line}")
          end
        end)

      {:error, reason} ->
        IO.warn("Failed to read .env file: #{inspect(reason)}")
    end

  false ->
    IO.warn(".env file not found at #{env_filepath}")
end

# We don't run a server during test. If one is required,
# you can enable the server option below.
config :catatan_backend, CatatanBackendWeb.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: 4002],
  secret_key_base: "SXla7JAodM+h89cJ9vtg/bHcJIgafQaTDmAq4OlIEYWLNEZ8FlY7v8h9IIM8OAAf",
  server: false

# In test we don't send emails
config :catatan_backend, CatatanBackend.Mailer, adapter: Swoosh.Adapters.Test

# Disable swoosh api client as it is only required for production adapters
config :swoosh, :api_client, false

# Print only warnings and errors during test
config :logger, level: :warning

# Initialize plugs at runtime for faster test compilation
config :phoenix, :plug_init_mode, :runtime

config :catatan_backend, CatatanBackend.CassandraClient,
  nodes: ["localhost:9042"],
  authentication: {
    Xandra.Authenticator.Password,
    username: "test", password: "test"
  },
  keyspace: "test_keyspace",
  encryption: false

config :catatan_backend, CatatanBackend.Replica, replica_id: "test_replica"

config :argon2_elixir,
  t_cost: 1,
  m_cost: 8

config :ex_aws,
  access_key_id: System.get_env("AWS_ACCESS_KEY_ID"),
  secret_access_key: System.get_env("AWS_SECRET_ACCESS_KEY"),
  region: System.get_env("AWS_REGION")

config :catatan_backend, CatatanBackend.Mailer, adapter: Swoosh.Adapters.ExAwsAmazonSES

config :catatan_backend, CatatanBackend.SQS, url: System.get_env("AWS_SQS_URL")

config :catatan_backend, CatatanBackend.MailerInformation,
  from_email: System.get_env("FROM_EMAIL")
