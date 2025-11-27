import Config

if System.get_env("PHX_SERVER") do
  config :catatan_backend, CatatanBackendWeb.Endpoint, server: true
end

if config_env() == :prod do
  secret_key_base =
    System.get_env("SECRET_KEY_BASE") ||
      raise """
      environment variable SECRET_KEY_BASE is missing.
      You can generate one by calling: mix phx.gen.secret
      """

  System.get_env()["CATATAN_KEYSPACES_NODE_HOST"] ||
    raise """
      environment variable KEYSPACES_NODE_HOST is missing.
    """

  System.get_env("CATATAN_KEYSPACES_USERNAME") ||
    raise """
      environment variable KEYSPACES_USERNAME is missing.
    """

  System.get_env("CATATAN_KEYSPACES_PASSWORD") ||
    raise """
      environment variable KEYSPACES_PASSWORD is missing.
    """

  System.get_env("CATATAN_KEYSPACES_NAME") ||
    raise """
      environment variable KEYSPACES_NAME is missing.
    """

  System.get_env("CATATAN_REPLICA_ID") ||
    raise """
      environment variable CATATAN_REPLICA_ID is missing.
    """

  System.get_env("AWS_SES_REGION") ||
    raise """
      environment variable AWS_SES_REGION is missing.
    """

  System.get_env("AWS_SES_ACCESS_KEY_ID") ||
    raise """
      environment variable AWS_SES_ACCESS_KEY_ID is missing.
    """

  System.get_env("AWS_SES_SECRET_ACCESS_KEY") ||
    raise """
      environment variable AWS_SES_SECRET_ACCESS_KEY is missing.
    """

  System.get_env("AWS_SQS_URL") ||
    raise """
      environment variable AWS_SQS_URL is missing.
    """

  System.get_env("FROM_EMAIL") ||
    raise """
      environment variable FROM_EMAIL is missing.
    """

  host = System.get_env("PHX_HOST") || "example.com"
  port = String.to_integer(System.get_env("PORT") || "8000")

  config :catatan_backend, :dns_cluster_query, System.get_env("DNS_CLUSTER_QUERY")

  config :catatan_backend,
         :frontend_host,
         System.get_env("FRONTEND_HOST") || "https://catatan.app"

  config :catatan_backend, CatatanBackendWeb.Endpoint,
    url: [host: host, port: 443, scheme: "https"],
    http: [
      ip: {0, 0, 0, 0, 0, 0, 0, 0},
      port: port
    ],
    secret_key_base: secret_key_base

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
    replica_id: System.get_env("CATATAN_REPLICA_ID") || "prod_replica"
end

config :catatan_backend, CatatanBackend.Mailer, adapter: Swoosh.Adapters.ExAwsAmazonSES

config :ex_aws,
  access_key_id: System.get_env("AWS_ACCESS_KEY_ID"),
  secret_access_key: System.get_env("AWS_SECRET_ACCESS_KEY"),
  region: System.get_env("AWS_REGION")

config :catatan_backend, CatatanBackend.SQS, url: System.get_env("AWS_SQS_URL")

config :catatan_backend, CatatanBackend.MailerInformation,
  from_email: System.get_env("FROM_EMAIL")
