defmodule CatatanBackendWeb.EmailController do
  use CatatanBackendWeb, :controller

  alias CatatanBackendWeb.Response

  def index(conn, _params) do
    conn |> Response.success_response("Success email data", %{})
  end
end
