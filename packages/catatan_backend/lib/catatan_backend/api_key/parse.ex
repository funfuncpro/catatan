defmodule CatatanBackend.ApiKey.Parse do
  @moduledoc """
  This module provides functions for parsing API keys.
  """

  @type t :: %__MODULE__{
          id: String.t(),
          key: String.t()
        }

  defstruct [:id, :key]

  @spec parse(String.t()) :: {:ok, t} | {:error, :invalid_format}
  def parse(""), do: {:error, :invalid_format}

  def parse(api_key) do
    case String.split(api_key, "_", parts: 2) do
      ["catatan", rest] ->
        case String.split(rest, ":", parts: 2) do
          [id, key] ->
            case {id, key} do
              {"", _} -> {:error, :invalid_format}
              {_, ""} -> {:error, :invalid_format}
              {id, key} -> {:ok, %__MODULE__{id: id, key: key}}
            end

          _ ->
            {:error, :invalid_format}
        end

      _ ->
        {:error, :invalid_format}
    end
  end
end
