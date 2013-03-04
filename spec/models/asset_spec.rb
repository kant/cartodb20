# encoding: utf-8
require 'ostruct'
require 'rack/test'
require 'pg'
require 'sequel'
#require_relative '../spec_helper'

Sequel::Model.db = Sequel.postgres('carto_db_test')
require_relative '../../app/models/asset'

describe Asset do
  before(:all) do
    @user = OpenStruct.new(
      id:       rand(100),
      username: 'test',
      email:    'client@example.com',
      password: 'clientex'
    )
    @configuration = { assets: { 'max_file_size' => 10485670 } }
  end

  describe 'validations' do
    it 'requires a user_id' do
      asset = Asset.new(configuration: @configuration)
      asset.configuration.class.should == Hash

      expect { asset.save }.to raise_error(Sequel::ValidationFailed)
      asset.errors.full_messages.include?("user_id can't be blank")
        .should == true
    end

    it 'requires a valid file' do
      asset = Asset.new(
        configuration:  @configuration,
        user:           @user,
        asset_file:     file_fixture_for('db/fake_data/i_dont_exist.json')
      )
      
      expect { asset.save }.to raise_error(Sequel::ValidationFailed)
      asset.errors.full_messages.should == ["asset_file is invalid"]
    end

    it 'rejects files bigger than 10 MB' do
      asset = Asset.new(
        configuration:  @configuration,
        user:           @user,
        asset_file: file_fixture_for('spec/support/data/GLOBAL_ELEVATION_SIMPLE.zip')
      )

      expect { asset.save }.to raise_error(Sequel::ValidationFailed)
      asset.errors.full_messages.should == ["asset_file is too big, 10Mb max"]
    end
  end # validations

  describe '#save' do
    it 'uploads the asset_file to s3 passing a full path' do
      asset = Asset.create(
        configuration:  @configuration,
        user:           @user,
        asset_file:     file_fixture_for('db/fake_data/simple.json')
      )
      
      asset.public_url  .should match(%r{#{@user.username}/assets/simple.json})
      asset.in_remote?  .should == true
    end

    it 'uploads the asset_file to s3 passing an uploaded file' do
      asset_file = Rack::Test::UploadedFile.new(
        file_fixture_for('db/fake_data/column_number_to_boolean.csv'), 'text/csv'
      )

      asset = Asset.create(
        configuration:  @configuration,
        user:           @user,
        asset_file:     asset_file
      )
      
      asset.public_url  .should =~ %r{user/#{@user.username}/.*to_boolean.csv}
      asset.in_remote?  .should == true
    end
  end #save

  describe '#destroy' do
    it 'removes remote files' do
      asset = Asset.create(
        configuration:  @configuration,
        user:           @user,
        asset_file:     file_fixture_for('db/fake_data/simple.json')
      )

      asset.in_remote?.should == true
      asset.destroy
      asset.in_remote?.should == false
    end
  end #destroy

  describe '#public_values' do
    it 'returns public attributes' do
      asset = Asset.new(
        configuration:  @configuration,
        user:           @user,
        asset_file:     file_fixture_for('db/fake_data/simple.json')
      )

      asset.public_values.should == {
        "id"            => nil,
        "public_url"    => nil,
        "user_id"       => @user.id
      }
    end
  end #public_values

  def file_fixture_for(path)
    File.join(File.dirname(__FILE__), '..', '..', path)
  end #file_fixture_for
end # Asset

