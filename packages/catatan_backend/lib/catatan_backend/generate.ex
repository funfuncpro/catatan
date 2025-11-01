defmodule CatatanBackend.GenerateID do
  @moduledoc """
  Module responsible for generating unique IDs for entity in the CatatanBackend application.
  This module use nanoID library to generate unique IDs.
  """

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
