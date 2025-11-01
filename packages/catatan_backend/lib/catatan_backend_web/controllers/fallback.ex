defmodule CatatanBackendWeb.FallbackController do
  use CatatanBackendWeb, :controller
  alias CatatanBackendWeb.Response

  def call(conn, {:error, :not_found}) do
    conn
    |> put_status(:not_found)
    |> Response.error_response("Not found", %{
      resource: "The requested resource could not be found"
    })
  end

  def call(conn, {:error, :unauthorized}) do
    conn
    |> put_status(:unauthorized)
    |> Response.error_response("Unauthorized", %{
      authorization: "You are not authorized to access this resource"
    })
  end
end
