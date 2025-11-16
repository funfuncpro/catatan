defmodule CatatanBackendWeb.Error do
  @moduledoc """
  A module for handling errors in the CatatanBackendWeb application.
  """

  @doc """
  Converts an error from an Ecto changeset into a human-readable string.
  """
  @spec format_ecto_error(keyword()) :: {:error, map()}
  def format_ecto_error(errors) do
    errors
    |> Map.new(fn {field, {message, _opts}} -> {field, message} end)
  end
end
