/**
 * This workflow updates Metadata or creates Assets based on CSV data.
 **/
var kParentTestFolder = 'Merlin Test/';
var kFileToImport = kParentTestFolder + "MerlinTest.csv";
var kBrandLookupFile = kParentTestFolder + "BrandEditionLookup.csv";

var myBrandLookupArray = {};
var kCsvPrimaryKeyColumn = 0;

function indexOf(theArray, theObject)
{
	for (var ai = 0; ai &lt; theArray.length; ++ai)
	{
		if (theArray[ai] == theObject)
		{
			return ai;
		}
	}
	return -1;
}

/**
 * Transform class structure
 *
 * @param theTransformFunction the function to transform the value into something else
 * @param theFieldId the field to write into.  If null, we'll write into the field given by the csv header.  If not null, we'll write the original value there + the transformed value into this location
 * @constructor
 */
var Transform = function(theTransformFunction, theFieldId)
{
	/**
	 * function to transform the data. Should have a single param (the value) and return the transformed value.
	 * There are two optional params, row and columns respectively that are also passed.  Row is the entire row of data
	 * and columns is the header column (so you can reference other columns to write into the transform as well.
	 */
	this.tranformFunction = theTransformFunction;
	this.fieldId = theFieldId;//Field id to write data into.  If null, we just write to the location defined by the header of the column
};

var myTransforms = {
	"http://hearst.com/ns/legacy_m librarian" : new Transform(transformBoolean, null),
	"http://hearst.com/ns/legacy_m rights1" : new Transform(transformBoolean, "http://hearst.com/ns/legacy_m rights_transform"),
	"http://hearst.com/ns/legacy_m/picuse edition" : [new Transform(brandLookup, "http://ns.hearst.com/descriptive/en/1.0/ Brand"),
		new Transform(issueLookup, "http://ns.hearst.com/descriptive/en/1.0/ Issue_Name"),
		new Transform(editionLookup, "http://ns.hearst.com/administrative/en/1.0/ Edition"),
		new Transform(ceLookup, "http://ns.hearst.com/administrative/en/1.0/ Corporate_Entity"),
		new Transform(originLookup, "http://ns.hearst.com/administrative/en/1.0/ Origin")],
	"http://hearst.com/ns/legacy_m rowguid" : new Transform(keywords, "http://ns.hearst.com/descriptive/en/1.0/ Hearst_Keywords"),
	"http://hearst.com/ns/legacy_m/picuse picnotes" : new Transform(oneToOne, "http://ns.hearst.com/administrative/en/1.0/ Asset_Use"),
	"http://hearst.com/ns/legacy_m/picuse page" : new Transform(oneToOne, "http://ns.hearst.com/descriptive/en/1.0/ Page_Range"),
	// add -mike
	"http://hearst.com/ns/legacy_m archiveddt" : new Transform(oneToOne, "http://ns.hearst.com/administrative/en/1.0/ Archived_Date"),
	"http://hearst.com/ns/legacy_m cbyline280" : new Transform(oneToOne, "http://ns.hearst.com/administrative/en/1.0/ Byline"),	
	"http://hearst.com/ns/legacy_m capt2120" : new Transform(oneToOne, "http://ns.hearst.com/descriptive/en/1.0/ Caption"),
	"http://hearst.com/ns/legacy_m city290" : new Transform(oneToOne, "http://ns.hearst.com/administrative/en/1.0/ City"),
	"http://hearst.com/ns/legacy_m credit2110" : new Transform(oneToOne, "http://ns.hearst.com/administrative/en/1.0/ Contributor"),
	"http://hearst.com/ns/legacy_m ctry2101" : new Transform(oneToOne, "http://ns.hearst.com/administrative/en/1.0/ Country"),
	"http://hearst.com/ns/legacy_m/picuse printwhen" : new Transform(oneToOne, "http://ns.hearst.com/administrative/en/1.0/ Cover_Date"),
	"http://hearst.com/ns/legacy_m datecr255" : new Transform(oneToOne, "http://ns.hearst.com/administrative/en/1.0/ Creation_Date"),
	"http://hearst.com/ns/legacy_m cbyline280" : new Transform(oneToOne, "http://ns.hearst.com/descriptive/en/1.0/ Creator"),
	"http://hearst.com/ns/legacy_m mhead2105" : new Transform(oneToOne, "http://ns.hearst.com/descriptive/en/1.0/ Headline"),
	"http://hearst.com/ns/legacy_m ud_dt_1" : new Transform(oneToOne, "http://ns.hearst.com/administrative/en/1.0/ On_Stand_Date"),
	"http://hearst.com/ns/legacy_m ud_dt_1" : new Transform(noDate, "http://ns.hearst.com/administrative/en/1.0/ Off_Stand_Date"),
	"http://hearst.com/ns/legacy_m pubdate" : new Transform(oneToOne, "http://ns.hearst.com/administrative/en/1.0/ Publication_Date"),
	"http://hearst.com/ns/legacy_m section" : new Transform(oneToOne, "http://ns.hearst.com/administrative/en/1.0/ Status"),
	"http://hearst.com/ns/legacy_m cstate" : new Transform(oneToOne, "http://ns.hearst.com/administrative/en/1.0/ Story_Name"),
	"http://hearst.com/ns/legacy_m mhead2105" : new Transform(oneToOne, "http://ns.hearst.com/descriptive/en/1.0/ Title"),
	// end add -mike
	"http://hearst.com/ns/legacy_m zone" : [new Transform(zone, "http://ns.hearst.com/descriptive/en/1.0/ Cover_Display_Date"),
		new Transform(zoneIssue, "http://ns.hearst.com/descriptive/en/1.0/ Issue_Name"),
		new Transform(zoneOrigin, "http://ns.hearst.com/administrative/en/1.0/ Origin"),
		new Transform(zoneCE, "http://ns.hearst.com/administrative/en/1.0/ Corporate_Entity")]};

/**
 * Transform functions
 **/

function transformBoolean(theData)
{
	if (theData == '1')
	{
		return 'true';
	}
	return 'false';
}

function oneToOne(theData)
{
	return theData;
}

function noDate(theData)
{
	return "1900-01-01";
}

/**
 * Where we're grabbing keywords from
 */
var myKeywordColumns = ["http://hearst.com/ns/legacy_m ckey1",
	"http://hearst.com/ns/legacy_m ckey3",
	"http://hearst.com/ns/legacy_m ckey4",
	"http://hearst.com/ns/legacy_m ckey5",
	"http://hearst.com/ns/legacy_m ckey6",
	"http://hearst.com/ns/legacy_m ckey7",
	"http://hearst.com/ns/legacy_m ckey8"];
/**
 * Concatenate values by comma separation (to search per usual in a multi-value field)
 *
 * @param theData the single value from our cell
 * @param theOverallRow the full row of data
 */
function keywords(theData, theOverallRow, theColumns)
{
	var aReturn = "";
	var aSeparatorCharacter = "";
//	 Remove. The original data was rowguid, and we don't really want that. -mike
//	if(theData != null)
//	{
//		aReturn += theData;
//		aSeparatorCharacter = ",";
//	}
	for(var ai in myKeywordColumns)
	{
		var aValue = theOverallRow[indexOf(theColumns, myKeywordColumns[ai])];
		if(aValue != null &amp;&amp; aValue != "")
		{
			aReturn += aSeparatorCharacter + aValue;
			aSeparatorCharacter = ",";
		}
	}
	return aReturn;
}

function capitalizeFirstLetter(theData)
{
	return theData.replace(/\w\S*/g, function(theText){return theText.charAt(0).toUpperCase() + theText.substr(1).toLowerCase();});
}

function readBrandLookupIntoMemory()
{
	var aDataFile = new ManagedFile(kBrandLookupFile);
	var aDataReader = aDataFile.getBufferedReader();

	aDataReader.readLine();//Remove Headers
	var aLine = aDataReader.readLine();
	while (aLine != null)
	{
		var aRow = parseCSV(aLine,",")[0];
		if(myBrandLookupArray[aRow[0].toLowerCase()] == null)
		{
			myBrandLookupArray[aRow[0].toLowerCase()] = aRow;
		}
		aLine = aDataReader.readLine();
	}
	aDataReader.close();
	//logAtLevel("myBrandLookupArray:" + JSON.stringify(myBrandLookupArray), "MerlinDataMigration", logLevels.INFO);
}

function internalLookup(theData, theIndex)
{
	if(theData != null)
	{
		var aKey = trim(theData).toLowerCase();
		var anArray = myBrandLookupArray[aKey];
		//logAtLevel("key:" + aKey + " Array:" + JSON.stringify(anArray), "MerlinDataMigration", logLevels.CONFIG);
		if(anArray != null &amp;&amp; anArray[theIndex] != null &amp;&amp; anArray[theIndex] != "")
		{
			return anArray[theIndex];
		}
	}
	return null;
}

function brandLookup(theData)
{
	return internalLookup(theData, 1);
}

function issueLookup(theData)
{
	return internalLookup(theData, 2);
}

function editionLookup(theData)
{
	return internalLookup(theData, 3);
}

function ceLookup(theData)
{
	return internalLookup(theData, 4);
}

function originLookup(theData)
{
	return internalLookup(theData, 5);
}

var myMonths = ["january",
	"february",
	"march",
	"april",
	"may",
	"june",
	"july",
	"august",
	"september",
	"october",
	"november",
	"december"];

var mySeasons = ["winter", "fall", "summer", "spring"];

function zone(theData, theOverallRow, theColumns)
{
	var aYear = theOverallRow[indexOf(theColumns, "http://hearst.com/ns/legacy_m/picuse printwhen")];
	if(theData == null)
	{
		return aYear;
	}
	if(aYear != null &amp;&amp; aYear.length &gt; 3)
	{
		aYear = aYear.substring(0, 4);
	}
	if(indexOf(myMonths, theData.toLowerCase()) &gt; -1 || indexOf(mySeasons, theData.toLowerCase()) &gt; -1)
	{
		return capitalizeFirstLetter(theData) + " " + aYear;
	}
	if(theData.indexOf("FALL WINTER") &gt; -1)
	{
		return "Fall " + aYear + "/Winter " + aYear;
	}
	if(theData.indexOf("SPRING SUMMER") &gt; -1)
	{
		return "Spring " + aYear + "/Summer " + aYear;
	}
	if(theData == "JANUARY FEBRUARY")
	{
		return "January " + aYear + "/February " + aYear;
	}
	if(theData == "MARCH APRIL")
	{
		return "March " + aYear + "/April " + aYear;
	}
	if(theData == "JUNE JULY")
	{
		return "June " + aYear + "/July " + aYear;
	}
	if(theData == "JULY AUGUST")
	{
		return "July " + aYear + "/August " + aYear;
	}
	if(theData == "NOVEMBER DECEMBER")
	{
		return "November " + aYear + "/December " + aYear;
	}
	if(theData == "PROM")
	{
		return "Winter " + aYear + "/Spring " + aYear;
	}
	if(theData == "BELEZA")
	{
		return "May 2006";
	}
	if(theData == "AFL")
	{
		return "Fall 2007";
	}
	return aYear;
}

function zoneIssue(theData)
{
	if(theData != null)
	{
		if(theData.indexOf("BIG BLACK BOOK") &gt; -1)
		{
			return "Big Black Book";
		}
		if(theData.indexOf("RUNWAY REPORT") &gt; -1)
		{
			return "Runway Report";
		}
		if(theData.indexOf("PROM") &gt; -1)
		{
			return "Prom";
		}
		if(theData.indexOf("BELEZA") &gt; -1)
		{
			return "Beleza";
		}
		if(theData.indexOf("AFL") &gt; -1)
		{
			return "A Fashionable Life";
		}
	}
	return null;
}

function zoneCE(theData)
{
	if(theData != null &amp;&amp; (theData == "" || theData.indexOf("HMI") &gt; -1 || theData.indexOf("SPEC") &gt; -1 || theData.indexOf("LOGO") &gt; -1))
	{
		return "HMI Editorial";
	}
	return null;
}

function zoneOrigin(theData)
{
	if(theData != null)
	{
		if(theData.indexOf("SPEC") &gt; -1)
		{
			return "stock:portfolio";
		}
		if(theData.indexOf("LOGO") &gt; -1)
		{
			return "FIXME";
		}
	}
	return null;
}

/*START DataImportLibrary*/

/**
 * Data import library.
 * runImport function should be run externally to kick off the read of a csv file, generation of placeholder assets (potentially),
 * writing metadata into the fields, and transforming data via JS functions passed in.
 *
 * The format of data we'd expect is a csv file with the first row being the Field ID's of where MediaBeacon should write
 * the data.
 *
 * There are two javascript classes of note that are used with this, Transform and ImportConfig.  ImportConfig allows
 * passing and setting data related to the import (see below for details).  Transform allows passing a field to write transformed
 * data into as well as a javascript function to transform the data.
 */

/**
 * Config class for doing an import.  There are other internal params that can be set to change behavior
 *
 * @param theFileToImport the csv file to import
 * @param theTransforms a map of fieldid -&gt; transform objects (@see Transform above)
 * @param theBaseFolder the base folder to import into
 * @param thePrimaryKeyIndex Which column in the document contains the key we should use to find the asset.
 * @constructor
 */
var ImportConfig = function(theFileToImport, theTransforms, theBaseFolder, thePrimaryKeyIndex)
{
	this.importFile = theFileToImport;
	this.transforms = theTransforms;
	this.baseFolder = theBaseFolder;
	this.primaryKeyIndex = thePrimaryKeyIndex;
	this.maxRows = 2000000;//maximum rows for the script to process
	this.createMissing = true;//Create blank assets for items not found
	this.csvSeparator = ",";//Separator character
	this.foundFile = "Found.csv";//Logging file for successful lines
	this.rejectFile = "NotFound.csv";//Logging file for not found lines
	this.errorFile = "Error.csv";//Logging file for lines that generated an error
	this.writeOnlyTransforms = false;//If true, don't write any data unless there's a transformation function for it
	this.ignoredColumnName = "Ignore";//Any column matching this name is not written.
};

var kDataImportLibraryName = "DataImportLibrary";

var myColumns;

var myConfig;

/**
 * Cache for list fields read from headers
 * We lookup with manager once, reuse value after
 */
var myIsListField = {};

/**
 * Is the field id a container field in MediaBeacon
 *
 * @param theFieldId
 * @returns {*}
 */
function isContainerField(theFieldId)
{
	var anIsContainer = myIsListField[theFieldId];
	if(anIsContainer == null)
	{
		anIsContainer = fieldManager.isContainer(getPropertyFromFieldId(theFieldId));
		myIsListField[theFieldId] = anIsContainer;
	}
	return anIsContainer;
}

/**
 * get a property object from a field id
 *
 * @param theFieldId format: [namespace] [field]
 * @returns property if fieldId is valid, null otherwise
 */
function getPropertyFromFieldId(theFieldId)
{
	var aSplit = theFieldId.split(" ");
	if(aSplit.length != 2)
	{
		return null;
	}
	return new Property(aSplit[0], aSplit[1]);
}

/**
 * trim whitespace
 *
 * @param str
 * @returns {XML|string|void}
 */
function trim(str)
{
	return str.replace(/^\s+|\s+$/g,"");
}

/**
 * CSV Line Parser
 *
 * @param theString string delimited csv string
 * @param theSeparator separator override
 */
function parseCSV(theString, theSeparator)
{
	var universalNewline = /\r\n|\r|\n/g;
	var a = (theString.replace(/""/g,'&amp;dquote;')).split(universalNewline);
	for(var i in a)
	{
		for (var f = a[i].split(theSeparator = theSeparator || ","), x = f.length - 1, sl; x &gt;= 0; x--)
		{
			sl = trim(f[x]);
			if (sl.charAt(sl.length - 1) == '"')
			{
				if (sl.length &gt; 1 &amp;&amp; sl.charAt(0) == '"')
				{
					f[x] = (sl.replace(/^"|"$/g,'')).replace(/&amp;dquote;/g, '"');
				} else if (x)
				{
					f.splice(x - 1, 2, [f[x - 1], f[x]].join(theSeparator));
				} else
				{
					f = f.shift().split(theSeparator).concat(f);
				}
			} else f[x] = (sl.replace(/^"|"$/g,'')).replace(/&amp;dquote;/g, '"');
		}
		a[i] = f;
	}
	return a;
}

/**
 * Return a timestamp with the format "m/d/yy h:MM:ss TT" (for logging)
 *
 * @type {Date}
 */
function timeStamp()
{
	var now = new Date();
	var date = [ now.getMonth() + 1, now.getDate(), now.getFullYear() ];
	var time = [ now.getHours(), now.getMinutes(), now.getSeconds() ];
	var suffix = ( time[0] &lt; 12 ) ? "AM" : "PM";
	time[0] = ( time[0] &lt; 12 ) ? time[0] : time[0] - 12;
	if (time[0] == 0 ? time[0] : 12);
	for ( var i = 1; i &lt; 3; i++ )
	{
		if ( time[i] &lt; 10 )
		{
			time[i] = "0" + time[i];
		}
	}
	return date.join("/") + " " + time.join(":") + " " + suffix;
}

/**
 * Ensures that the folder and its parent hierarchy (to the root) exist,
 * creating missing folders, if necessary.
 *
 * @param theFolderPath
 */
function ensureFolderExists(theFolderPath)
{
	logAtLevel("ensureFolderExists:  " + theFolderPath, kDataImportLibraryName, logLevels.CONFIG);
	if (theFolderPath == null || theFolderPath.length == 0)
	{
		return;
	}
	var aParentPath = "";
	var aStart = 0;
	while (aStart != -1)
	{
		if (aStart != 0)
		{
			aStart ++;
		}
		var aEnd = (theFolderPath.length &gt; aStart) ? theFolderPath.indexOf('/', aStart) : -1;
		var aFolderName = (aEnd != -1) ? theFolderPath.substring(aStart, aEnd) : theFolderPath.substring(aStart);
		logAtLevel("start:  " + aStart + ";  end:  " + aEnd + ";  folder:  '" + aFolderName + "'", kDataImportLibraryName, logLevels.FINE);
		if (aFolderName != null &amp;&amp; aFolderName.length &gt; 0)
		{
			try
			{
				// Instantiate ManagedFolder -- succeeds if parent + folder exists
				logAtLevel("  Checking folder:  '" + aParentPath + aFolderName + "'", kDataImportLibraryName, logLevels.FINE);
				var aManagedFolder = new ManagedFolder(aParentPath + aFolderName);
			} catch (theException)
			{
				// Folder doesn't exist -- create it
				logAtLevel("  Creating folder:  '" + aParentPath + aFolderName + "'", kDataImportLibraryName, logLevels.WARNING);
				try
				{
					fileManager.folderNew(new ManagedFolder(aParentPath), aFolderName);
				} catch (theException2)
				{
					// This typically isn't fatal -- another workflow may have just created the same folder
					logAtLevel("    Failed to create the folder - exception:  " + theException2, kDataImportLibraryName, logLevels.WARNING);
				}
			}
			aParentPath += aFolderName + "/";
		}
		aStart = aEnd;
	}
}

/**
 * Process a row of data
 *
 * @param theRow
 * @param theMetadata
 * @param theTransformFunction
 */
function processRow(theRow, theAsset, theTransformMap)
{
	logAtLevel("processRow:  " + theRow, kDataImportLibraryName, logLevels.FINE);
	for(var anIndex in myColumns)
	{
		if(myColumns[anIndex] != myConfig.ignoredColumnName)
		{
			applyData(theTransformMap[myColumns[anIndex]], theAsset.xmp, theAsset.xmp.meta, myColumns[anIndex], theRow[anIndex], theRow);
		}
	}
}

/**
 * add the data to the metadata
 *
 * @param theTransformationFunction
 * @param theMetadata
 * @param theFieldId
 * @param theValue
 */
function applyData(theTransformationObject, theXmp, theMetadata, theFieldId, theValue, theRow)
{
	logAtLevel("applyData:  " + theFieldId + " " + theValue, kDataImportLibraryName, logLevels.CONFIG);
	/**
	 * If we have a field defined in the object, we write the transformed value there.  The original value
	 * will be written into the csv defined field.
	 * If no field is defined, we're going to write it to the column defined by the csv file
	 */
	if(theTransformationObject != null)
	{
		//If not an array, wrap
		if(!(theTransformationObject instanceof Array))
		{
			theTransformationObject = [theTransformationObject];
		}
		for(var ai in theTransformationObject)
		{
			if(theTransformationObject[ai].fieldId != null)
			{
				var aValue = theTransformationObject[ai].tranformFunction(theValue, theRow, myColumns);
				if(aValue != null)
				{
					writeField(theXmp, theMetadata, theTransformationObject[ai].fieldId, aValue);
				}
			} else
			{
				theValue = theTransformationObject[ai].tranformFunction(theValue, theRow, myColumns);
			}
		}
	}
	if(!myConfig.writeOnlyTransforms || (theTransformationObject != null &amp;&amp; theTransformationObject[ai].fieldId == null))
	{
		if(theValue != null &amp;&amp; theValue != "" &amp;&amp; theValue.toLowerCase() != "null")
		{
			writeField(theXmp, theMetadata, theFieldId, theValue);
		}
	}
}

/**
 * Write function, abstracting away the format we're writing into (container fields), and field id -&gt; property
 *
 * @param theMetadata metadata object
 * @param theFieldId field id to write to
 * @param theValue string value to write
 */
function writeField(theXmp, theMetadata, theFieldId, theValue)
{
	if(isContainerField(theFieldId))
	{
		logAtLevel("Writing container field " + theFieldId + ":" + theValue, kDataImportLibraryName, logLevels.FINE);
		var aBag = theXmp.newBag();
		var aProperty = getPropertyFromFieldId(theFieldId);
		theMetadata.removeAll(aProperty);
		theMetadata.addProperty(aProperty, aBag);
		var aValues = theValue.split(",");
		for(var anIndex in aValues)
		{
			aBag.addItem(aValues[anIndex]);
		}
	} else
	{
		logAtLevel("Writing field " + theFieldId + ":" + theValue, kDataImportLibraryName, logLevels.FINE);
		theMetadata.addProperty(getPropertyFromFieldId(theFieldId), theValue);
	}
}

/**
 * This function triggers the read of a csv file, generation of placeholder assets (potentially),
 * writing metadata into the fields, and transforming data via JS functions passed in.
 *
 * @param theConfig @see ImportConfig
 */
function runImport(theConfig)
{
	myConfig = theConfig;
	var aDataFile = new ManagedFile(myConfig.importFile);
	var aDataReader = aDataFile.getBufferedReader();
	logAtLevel("STARTING IMPORT OF [" + aDataFile.path + "]", kDataImportLibraryName, logLevels.WARNING);

	var aReject = fileManager.fileNew(aDataFile.parent, myConfig.rejectFile).getBufferedWriter();
	aReject.writeFullString("The following list of files where NOT FOUND in the database");
	aReject.newLine();

	var aFound = fileManager.fileNew(aDataFile.parent, myConfig.foundFile).getBufferedWriter();
	aFound.writeFullString("The following list of files where FOUND in the database");
	aFound.newLine();

	var anErrorFile = fileManager.fileNew(aDataFile.parent, myConfig.errorFile).getBufferedWriter();
	anErrorFile.writeFullString("The following list of files where unable to be imported in the database");
	anErrorFile.newLine();

	var aLine = new String(aDataReader.readLine());
	myColumns = parseCSV(aLine,",")[0];

	for (var anIndex = 0; anIndex &lt; myColumns.length; anIndex++)
	{
		myColumns[anIndex] = trim(myColumns[anIndex]);
	}
	logAtLevel("Found Columns: [" + myColumns + "]", kDataImportLibraryName, logLevels.WARNING);
	aLine = new String(aDataReader.readLine());
	var aLineCount = 0;

	while (aLine != null &amp;&amp; aLineCount++ &lt; myConfig.maxRows)
	{
		try
		{
			var aRow = parseCSV(new String(aLine), myConfig.csvSeparator)[0];

			var aFolderName = aRow[myConfig.primaryKeyIndex].replace(/\\/g, "/");
			aFolderName = aFolderName.match(/.*.\//);
			var aFinalFolder = myConfig.baseFolder + aFolderName;
			var aFilename = aRow[myConfig.primaryKeyIndex].replace(/\\/g, "/").split("/");
			aFilename = aFilename[aFilename.length - 1];
			var aRecord;
			if (myConfig.createMissing)
			{
				if (aFilename != null)
				{
					ensureFolderExists(aFinalFolder);
					try
					{
						var aDestinationFolder = new ManagedFolder(aFinalFolder);
						aRecord = fileManager.fileNew(new ManagedFolder(aDestinationFolder.path), aFilename);
					} catch (anError)
					{
						logAtLevel(anError, kDataImportLibraryName, logLevels.WARNING);
					}
				}
			} else
			{
				var aQuery = "select record_id from editorial, j15t_directory where file_name = '" + aFileName + "'" +
						" and j15c_full_path  = '" + aFinalFolder + "'" + " and directory_id = j15c_directory_id";
				var aRecordId = new SQL("Locate asset").queryForString(aQuery);
				if (aRecordId == null || aRecordId.length == 0)
				{
					logAtLevel("File Not Found: [" + aFilename + "]", kDataImportLibraryName, logLevels.WARNING);
				} else
				{
					logAtLevel("Found File: [" + aFilename + "][" + aRecordId + "]", kDataImportLibraryName, logLevels.WARNING);
					aRecord = fileManager.getFileObjectById(aRecordId);
				}
			}
			if(aRecord != null)
			{
				aFound.writeFullString(aLine);
				aFound.newLine();
				aFound.flush();
			} else
			{
				aReject.writeFullString(aLine);
				aReject.newLine();
				aReject.flush();
			}
			processRow(aRow, aRecord, myConfig.transforms);
			aRecord.writeXmp();
		} catch (anError)
		{
			logAtLevel(anError, kDataImportLibraryName, logLevels.WARNING);
			/* There was an error during processing */
			anErrorFile.writeFullString(anError);
			anErrorFile.newLine();
			anErrorFile.writeFullString(aLine);
			anErrorFile.newLine();
			anErrorFile.flush();
		}
		if(aLineCount % 25 == 0)
		{
			logAtLevel("Processing Line [" + aLineCount + "] End Time: " + timeStamp() , kDataImportLibraryName, logLevels.WARNING)
		}
		logAtLevel("Processing Line [" + aLineCount + "] End Time: " + timeStamp() , kDataImportLibraryName, logLevels.CONFIG);
		aLine = aDataReader.readLine();
	}
	anErrorFile.close();
	aReject.close();
	aFound.close();
	aDataReader.close();
	logAtLevel("Data Import Script Completed!", kDataImportLibraryName, logLevels.WARNING);
}

/*END DataImportLibrary*/

function main()
{
	readBrandLookupIntoMemory();
	//Uncomment the below two lines after initial import so we can iterate the transformation fields only.
	//aConfig.writeOnlyTransforms = true;
	//aConfig.createMissing = false;
	runImport(new ImportConfig(kFileToImport, myTransforms, kParentTestFolder, kCsvPrimaryKeyColumn));
}

main();