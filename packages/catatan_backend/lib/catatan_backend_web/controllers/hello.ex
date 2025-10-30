defmodule CatatanBackendWeb.HelloController do
  use CatatanBackendWeb, :controller

  def index(conn, _params) do
    json(conn, %{message: "hello world"})
  end
end
