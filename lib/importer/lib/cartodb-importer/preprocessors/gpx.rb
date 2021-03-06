module CartoDB
  module Import
    class GPX < CartoDB::Import::Preprocessor

      register_preprocessor :gpx

      def process!    
      
       @data_import = DataImport.find(:id=>@data_import_id)
       import_data = Array.new
       
       # generate a temporally filename 
       shp_file = temporary_filename
       
       # extract the 3 shp files (and associated dbf and so on)
       # it will create a folder
       ogr2ogr_bin_path = `which ogr2ogr`.strip

       # ogr2ogr does not manage well datetime fields in gpx to transform it to string in 
       # order to import correctly
       ogr2ogr_command = %Q{#{ogr2ogr_bin_path} -fieldTypeToString DateTime -f "ESRI Shapefile" #{shp_file} #{@working_data[:path]}}
       
       stdin,  stdout, stderr = Open3.popen3(ogr2ogr_command) 
  
        unless (err = stderr.read).empty?
          @data_import.log_error(err)
        end
        
       # then choose the track_points file to import
       Dir.foreach(shp_file) do |tmp_path|
          dirname = shp_file
          name = File.basename(tmp_path) 
          next if name =~ /^(\.|\_{2})/
          if name.include? ' '
            name = name.gsub(' ','_')
          end
          #fixes problem of different SHP archive files with different case patterns
          FileUtils.mv("#{dirname}/#{tmp_path}", "#{dirname}/#{name.downcase}") unless File.basename(tmp_path) == name.downcase
          name = name.downcase
          if CartoDB::Importer::SUPPORTED_FORMATS.include?(File.extname(name))
            if @working_data[:suggested_name]
              suggested = "#{@working_data[:suggested_name]}_#{File.basename( name, File.extname(name)).sanitize}"
            else
              suggested = File.basename( name, File.extname(name)).sanitize
            end
            import_data << {
              :ext => File.extname(name),
              :import_type => '.gpx',
              :suggested_name => suggested,
              :path => "#{dirname}/#{name}"
            }
          end
       end
       # construct return variables
       import_data       
      end  
    end
  end    
end