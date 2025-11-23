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

# For development, read and load environment variables from .env file

# For development, we disable any cache and enable
# debugging and code reloading.
#
# The watchers configuration can be used to run external
# watchers to your application. For example, we can use it
# to bundle .js and .css sources.
config :catatan_backend, CatatanBackendWeb.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: String.to_integer(System.get_env("PORT") || "8000")],
  check_origin: false,
  code_reloader: true,
  debug_errors: true,
  secret_key_base: "Z1oSHehZ7vBBzCC27KhTqI7B+Yo5WYkMuuEKnYSVtBTakvghYjZL/CumR0vRsFGa",
  watchers: []

config :catatan_backend, CatatanBackend.CassandraClient,
  nodes: [System.get_env("CATATAN_KEYSPACES_NODE_HOST")],
  authentication:
    {Xandra.Authenticator.Password,
     username: System.get_env("CATATAN_KEYSPACES_USERNAME"),
     password: System.get_env("CATATAN_KEYSPACES_PASSWORD")},
  keyspace: System.get_env("CATATAN_KEYSPACES_NAME"),
  encryption: true,
  transport_options: [
    cacertfile: Path.join([File.cwd!(), ".resource", "sf-class2-root.crt"])
  ]

config :catatan_backend, CatatanBackend.Replica,
  replica_id: System.get_env("CATATAN_REPLICA_ID") || "dev_replica"

# Enable dev routes for dashboard and mailbox
config :catatan_backend, dev_routes: true

# Do not include metadata nor timestamps in development logs
config :logger, :default_formatter, format: "[$level] $message\n"

# Set a higher stacktrace during development. Avoid configuring such
# in production as building large stacktraces may be expensive.
config :phoenix, :stacktrace_depth, 20

# Initialize plugs at runtime for faster development compilation
config :phoenix, :plug_init_mode, :runtime

# Disable swoosh api client as it is only required for production adapters.
config :swoosh, :api_client, false

config :catatan_backend, :env, :dev

config :catatan_backend, CatatanBackend.Mailer,
  adapter: Swoosh.Adapters.AmazonSES,
  region: System.get_env("AWS_SES_REGION"),
  access_key: System.get_env("AWS_SES_ACCESS_KEY_ID"),
  secret: System.get_env("AWS_SES_SECRET_ACCESS_KEY")

config :ex_aws,
  access_key_id: System.get_env("AWS_ACCESS_KEY_ID"),
  secret_access_key: System.get_env("AWS_SECRET_ACCESS_KEY"),
  region: System.get_env("AWS_REGION")

config :catatan_backend, CatatanBackend.SQS, url: System.get_env("AWS_SQS_URL")

config :catatan_backend, CatatanBackend.MailerInformation,
  from_email: System.get_env("FROM_EMAIL")
