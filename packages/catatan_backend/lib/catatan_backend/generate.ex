defmodule CatatanBackend.GenerateID do
  @moduledoc """
  Module responsible for generating unique IDs for entity in the CatatanBackend application.
  This module use nanoID library to generate unique IDs.
  """

  @doc """
  Generates a unique ID using with length
  """
  @spec generate_nano_id(number()) :: String.t()
  def generate_nano_id(length) do
    Nanoid.generate(
      size: length,
      alphabet: "0123456789abcdefghijklmnopqrstuvwxyz"
    )
  end

  @doc """
  Generates a unique ID using nanoID.
  """
  def generate_nano_id() do
    Nanoid.generate(
      size: 12,
      alphabet: "0123456789abcdefghijklmnopqrstuvwxyz"
    )
  end
end
