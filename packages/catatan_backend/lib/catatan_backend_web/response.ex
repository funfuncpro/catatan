defmodule CatatanBackendWeb.Response do
  use CatatanBackendWeb, :controller

  @moduledoc """
  A module for standardizing API responses in the CatatanBackendWeb application.
  """

  @doc """
  formats a failed response with given errors.
  """
  @spec error_response(Plug.Conn.t(), String.t(), map) :: map
  def error_response(conn, message, errors) do
    conn
    |> json(%{
      success: false,
      message: message,
      errors: errors
    })
  end

  @doc """
  formats a successful response with given data.
  """
  @spec success_response(Plug.Conn.t(), String.t(), map) :: map
  def success_response(conn, message, data) do
    conn
    |> json(%{
      success: true,
      message: message,
      data: data
    })
  end
end
