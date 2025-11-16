defmodule CatatanBackendWeb.Plugs.AuthPlug do
  @moduledoc """
  Plug for authenticating requests using OpenAuth JWT tokens.

  This plug:
  1. Extracts the JWT token from the Authorization header
  2. Verifies the token using OpenAuthClient
  3. Upserts the user in the database
  4. Assigns current_user to conn.assigns

  If authentication fails, it sends a 401 response.
  """

  import Plug.Conn
  require Logger

  alias CatatanBackend.OpenAuthClient
  alias CatatanBackend.Users

  @doc """
  Initialize the plug with options.

  Options:
  - required: boolean, if true sends 401 when token is missing/invalid (default: true)
  """
  def init(opts), do: opts

  @doc """
  Call function for the plug.
  Extracts and verifies the JWT token, then assigns current_user.
  """
  def call(conn, opts) do
    required = Keyword.get(opts, :required, true)

    IO.puts("\n=== AUTH PLUG DEBUG ===")
    IO.puts("Required: #{required}")
    IO.puts("Authorization header: #{inspect(get_req_header(conn, "authorization"))}")

    case extract_token(conn) do
      {:ok, token} ->
        IO.puts("Token extracted: #{String.slice(token, 0, 20)}...")
        result = verify_and_assign_user(conn, token, required)
        IO.puts("User assigned: #{inspect(Map.get(result.assigns, :current_user))}")
        IO.puts("======================\n")
        result

      :error ->
        IO.puts("No token found")
        IO.puts("======================\n")
        if required do
          conn
          |> put_resp_content_type("application/json")
          |> send_resp(401, Jason.encode!(%{error: "Missing or invalid authorization token"}))
          |> halt()
        else
          conn
        end
    end
  end

  # Extract JWT token from Authorization header
  defp extract_token(conn) do
    case get_req_header(conn, "authorization") do
      ["Bearer " <> token] -> {:ok, String.trim(token)}
      _ -> :error
    end
  end

  # Verify token and assign user to conn
  defp verify_and_assign_user(conn, token, required) do
    with {:ok, claims} <- OpenAuthClient.verify_token(token),
         {:ok, user_info} <- OpenAuthClient.extract_user_info(claims),
         {:ok, user_id} <- Users.upsert_user(user_info.email, user_info.external_id) do
      # Assign current user to connection
      conn
      |> assign(:current_user, %{
        user_id: user_id,
        email: user_info.email,
        external_id: user_info.external_id
      })
    else
      {:error, reason} ->
        Logger.warning("Authentication failed: #{inspect(reason)}")

        if required do
          conn
          |> put_resp_content_type("application/json")
          |> send_resp(401, Jason.encode!(%{error: "Invalid or expired token"}))
          |> halt()
        else
          conn
        end
    end
  end
end
