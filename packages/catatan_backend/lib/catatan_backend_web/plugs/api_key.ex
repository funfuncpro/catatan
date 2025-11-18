defmodule CatatanBackendWeb.Plugs.ApiKey do
  @moduledoc """
  This module responsible for api key plugs:

  - It will protect route with api key in authorization header
  """
  import Plug.Conn
  alias CatatanBackend.ApiKey
  alias CatatanBackendWeb.Response

  def init(opts), do: opts

  def call(conn, _opts) do
    case get_req_header(conn, "authorization") do
      ["Bearer " <> api_key] ->
        verify_and_assign(conn, api_key)

      _ ->
        send_unauthorized(conn)
    end
  end

  defp verify_and_assign(conn, api_key) do
    case ApiKey.verify_api_key(api_key) do
      {:ok, user_id} ->
        assign(conn, :api_key_user_id, user_id)

      {:error, _reason} ->
        send_unauthorized(conn)
    end
  end

  defp send_unauthorized(conn) do
    conn
    |> put_status(:unauthorized)
    |> Response.error_response("Unauthorized", %{
      authorization: "You are not authorized to access this resource"
    })
    |> halt()
  end
end
