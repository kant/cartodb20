# encoding: utf-8
require 'mime/types'
require_relative '../../services/data-repository/filesystem/s3/backend'

class Asset < Sequel::Model
  PUBLIC_ATTRIBUTES = %W{ id public_url user_id }

  #many_to_one :user
  attr_accessor :asset_file, :file
  attr_reader   :remote, :user

  def public_values
    Hash[PUBLIC_ATTRIBUTES.map { |attribute| [attribute, send(attribute)] }]
  end #public_values

  def validate
    super
    puts user_id
    errors.add(:user_id, "can't be blank")          if user_id.blank?
    #errors.add(:asset_file, "is too big, 10Mb max") if too_big?
    #errors.add(:asset_file, "is invalid")           if unreadable?
  end #validate

  def initialize(*args)
    super(*args)
    @remote = DataRepository::Filesystem::S3::Backend.new
  end #initialize

  def save
    super
    upload(asset_file) unless asset_file.blank?
  end #save

  def destroy
    super
    remove_remote_file unless public_url.blank?
  end #destroy

  def user=(user)
    @user     = user
    @user_id  = user.id
  end #user=

  def upload(file)
    url = remote.store("#{prefix}/#{basename}", stream)
    self.set(public_url: url.to_s)
    self.this.update(public_url: url.to_s)
  end #upload

  def remove_remote_file
    remote.delete(path_for(public_url))
  end #remove_remote_file

  private

  def prefix
    File.join('user', user.username, 'assets')
  end #prefix

  def object_options
    {
      acl:          :public_read,
      content_type: MIME::Types.type_for(file_prefix).first.to_s
    }
  end #object_options

  def unreadable?
    !File.readable?(payload)
  end # readable?

  def payload
    asset_file
    #file = (asset_file.is_a?(String))
    #File.open(asset_file)
    #File.open(asset_file.path)
  rescue Errno::ENOENT
    false
  end #file_or_prefix?

  def too_big?
    return false unless asset_file
    asset_file.size > Cartodb.config.fetch(:assets).fetch('max_file_size')
  end #too_big?
end # Asset

